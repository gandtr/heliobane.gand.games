/**
 * adaptive-sections — exact section switching for CozyAdaptive, run inside the audio engine.
 *
 * The libopenmpt worklet (vendor/chiptune3/chiptune3.worklet.js) renders through a
 * SectionRenderer; Node tests drive the same code with the same libopenmpt build. The main thread
 * only posts plans (SectionScheduler#plan) and hears back which section started where.
 *
 * How a boundary is made exact. libopenmpt processes a row when it renders the row's first
 * frame: by the time get_current_order/row report a new row, that row's notes have started. So
 * the renderer has to know where a row ends before rendering past it, and where the module would
 * go next without letting the audible module go there:
 *
 * - Row clock: libopenmpt rows last speed x floor(rate * 2.5 / tempo) frames (classic tempo).
 *   From a known row start (a seek, or the previous boundary), the renderer reads up to the
 *   row's end in one go and checks that the row did end there.
 * - Probe: a second, muted instance of the module follows the audible one read for read (muted,
 *   it costs a few percent of the audible render). At each row end the probe renders the next
 *   frame first, so the scheduler sees the module's natural next position. When the plan wants a
 *   different section, the audible module seeks before rendering that frame; both instances seek,
 *   so they stay in step.
 *
 * Rows the clock cannot time (row delays, fine pattern delays, tempo slides, a tempo factor, a
 * tempo factor changed inside the row, or a prediction that turned out wrong) are rendered in
 * whole chunks; if such a row can end its order where the plan acts, the probe steps through it
 * frame by frame instead, which is exact but costs more. A section change found only after a
 * chunk (which the above should prevent) is still made, late, and reported with exact: false.
 *
 * The probe is trusted only while it is in step with the audible module: on the same row and
 * the same frame (libopenmpt's position in seconds) after every read, and, before each
 * prediction is acted on, with the same speed, tempo and tempo factor. If it ever is not (it was
 * set up differently, or something moved or played one instance alone), the renderer stops
 * using it: section changes are then made late, with exact: false, until a seek puts both
 * instances on the same row again.
 *
 * Order ends: the order changes, or the same order starts again (a song wrap, or a jump to the
 * pattern's own order). A pattern loop (IT SBx, MOD/XM E6x) going back to its start is not an
 * order end: the loop is counted, and only the pass that falls out of the loop ends the order.
 * Loop counts restart whenever the module is moved (libopenmpt's do too).
 */

// libopenmpt pattern data: openmpt_module_get_pattern_row_channel_command's command slots and
// OpenMPT's internal effect numbers, which are the same for every module format.
const COMMAND_EFFECT = 3, COMMAND_PARAMETER = 5;
const CMD_POSITIONJUMP = 12, CMD_PATTERNBREAK = 14, CMD_TEMPO = 17, CMD_MODCMDEX = 19, CMD_S3MCMDEX = 20;

/**
 * Row facts for SectionScheduler, read from a libopenmpt module and cached per pattern row:
 * { last: the pattern's final row, jump: a position jump or pattern break, loop: how many times
 * a pattern loop on this row jumps back (0 for none), irregular: a row delay, fine pattern delay
 * or tempo slide, so the row clock cannot time it }.
 *
 * S00 (IT) repeats the channel's last non-zero S command, so an S00 after SB1 is a pattern loop
 * and an S00 after SE1 a row delay. That depends on what played before, so in a module that
 * uses S00 the facts also carry `sets` ([channel, param] for each non-zero S command) and
 * `recall` (the channels with S00), and SectionScheduler resolves the recall from the rows it
 * sees play. After a seek it needs the memory libopenmpt has there, which libopenmpt gets by
 * replaying the song from its start: `memoryAt(order, row)` follows the same path, from order 0
 * through the module's position jumps and pattern breaks.
 */
export function libopenmptRows(lib, mod) {
  const cache = new Map();
  const channels = lib._openmpt_module_get_num_channels(mod);
  const orders = lib._openmpt_module_get_num_orders(mod);
  const command = (pattern, row, ch, slot) => lib._openmpt_module_get_pattern_row_channel_command(mod, pattern, row, ch, slot);
  const patternOf = (order) => lib._openmpt_module_get_order_pattern(mod, order);
  const rowsOf = (pattern) => lib._openmpt_module_get_pattern_num_rows(mod, pattern);

  let recalls = false;
  for (let o = 0; o < orders && !recalls; o++) {
    const pattern = patternOf(o);
    for (let r = 0, n = rowsOf(pattern); r < n && !recalls; r++) {
      for (let ch = 0; ch < channels && !recalls; ch++) {
        recalls = command(pattern, r, ch, COMMAND_EFFECT) === CMD_S3MCMDEX && !command(pattern, r, ch, COMMAND_PARAMETER);
      }
    }
  }

  const facts = (pattern, row) => {
    const key = pattern * 65536 + row;
    let info = cache.get(key);
    if (info) return info;
    let jump = false, loop = 0, irregular = false;
    const sets = [], recall = [];
    for (let ch = 0; ch < channels; ch++) {
      const fx = command(pattern, row, ch, COMMAND_EFFECT);
      const param = command(pattern, row, ch, COMMAND_PARAMETER);
      const sub = param >> 4;
      if (fx === CMD_S3MCMDEX) (param ? sets.push([ch, param]) : recall.push(ch));
      if (fx === CMD_POSITIONJUMP || fx === CMD_PATTERNBREAK) jump = true;
      else if ((fx === CMD_S3MCMDEX && sub === 0xB) || (fx === CMD_MODCMDEX && sub === 0x6)) loop = Math.max(loop, param & 15);
      if ((fx === CMD_S3MCMDEX && param && (sub === 0xE || sub === 0x6)) || (fx === CMD_MODCMDEX && sub === 0xE) ||
          (fx === CMD_TEMPO && param < 0x20)) irregular = true;
    }
    info = { last: row >= rowsOf(pattern) - 1, jump, loop, irregular };
    if (recalls) Object.assign(info, { sets, recall });
    cache.set(key, info);
    return info;
  };

  // The S memory at the first entry to each order on the song's path from its start.
  const entries = new Map();
  if (recalls) {
    const memory = new Map(), seen = new Set();
    let o = 0, r = 0;
    while (o < orders && !seen.has(o * 65536 + r)) {
      seen.add(o * 65536 + r);
      const pattern = patternOf(o), rows = rowsOf(pattern);
      if (r >= rows) { o++; r = 0; continue; } // a separator, or a break past the pattern's end
      if (!entries.has(o)) entries.set(o, { row: r, memory: new Map(memory) });
      let next = null;
      for (; r < rows && !next; r++) {
        let to = null, at = null;
        for (const [ch, param] of facts(pattern, r).sets) memory.set(ch, param);
        for (let ch = 0; ch < channels; ch++) {
          const fx = command(pattern, r, ch, COMMAND_EFFECT);
          if (fx === CMD_POSITIONJUMP) to = command(pattern, r, ch, COMMAND_PARAMETER);
          else if (fx === CMD_PATTERNBREAK) at = command(pattern, r, ch, COMMAND_PARAMETER);
        }
        if (to !== null || at !== null) next = [to ?? o + 1, at ?? 0];
      }
      [o, r] = next ?? [o + 1, 0];
    }
  }

  const rowInfo = (order, row) => facts(patternOf(order), row);
  /** The S memory (channel -> param) libopenmpt has on arriving at order/row by a seek. */
  rowInfo.memoryAt = (order, row) => {
    const entry = entries.get(order), memory = new Map(entry?.memory);
    if (!recalls) return memory;
    const pattern = patternOf(order);
    for (let r = entry?.row ?? 0; r < row; r++) for (const [ch, param] of facts(pattern, r).sets) memory.set(ch, param);
    return memory;
  };
  return rowInfo;
}

/**
 * The section state machine. Feed it every new row position (observe); it says when a section
 * starts and whether that needs a seek. `rowInfo(order, row)` gives the row facts libopenmptRows
 * returns; sections reaching past `orders` (the module's order count) are ignored.
 */
export class SectionScheduler {
  constructor(rowInfo, orders = Infinity) {
    this.rowInfo = rowInfo;
    this.orders = orders;
    this.sections = {};
    this.section = null; // the section playing now
    this.queue = [];     // sections to play next, in order
    this.next = false;   // start queue[0] at the next order end instead of the section's end
    this.pos = null;     // { order, row } of the row playing now
    this._loops = new Map(); // pattern-loop row -> jumps back taken on this pass
    this._memory = new Map(); // channel -> last non-zero S param, for S00 (see libopenmptRows)
  }

  /** Row facts for a row of the playing pattern, with any S00 resolved from what played. */
  info(order, row) {
    const base = this.rowInfo(order, row);
    if (!base.recall?.length) return base;
    let { loop, irregular } = base;
    for (const ch of base.recall) {
      const param = this._memory.get(ch) ?? 0, sub = param >> 4;
      if (sub === 0xB) loop = Math.max(loop, param & 15);
      else if (sub === 0xE || sub === 0x6) irregular = true;
    }
    return { ...base, loop, irregular };
  }

  /**
   * Replace the plan: { sections: { name: [first, last] }, queue: [names], next, jump }.
   * `jump` names a section to start right now; the return value is then where to seek.
   */
  plan({ sections, queue = [], next = false, jump = null }) {
    if (sections) {
      this.sections = Object.fromEntries(Object.entries(sections).filter(([, r]) => r[1] < this.orders));
    }
    this.queue = queue.filter((name) => this.sections[name]);
    this.next = next && this.queue.length > 0;
    if (jump == null || !this.sections[jump]) return null;
    return this._start(jump, null).seek;
  }

  /** Something other than the plan moved the module to `pos` (null: somewhere unknown). */
  moved(pos) {
    this.pos = pos;
    this._loops.clear();
    if (pos) this._enter(pos.order, pos.row);
  }

  /** True while the playing row can end its order where the plan acts. */
  get exact() {
    if (!this.pos || !this.section) return false;
    const { order, row } = this.pos;
    const info = this.info(order, row);
    if (info.jump) return true;
    if (!info.last) return false;
    const [first, last] = this.sections[this.section];
    return this.next || order === last || order < first || order > last;
  }

  /**
   * A new row is starting at { order, row }. Returns null, or { section, seek } when a section
   * starts here: `seek` is where to go instead, or null when the module goes there itself.
   */
  observe(order, row) {
    const prev = this.pos;
    this.pos = { order, row };
    if (!prev) {
      this._enter(order, row); // after a move the renderer could not follow
      return null;
    }
    if (prev.order === order && prev.row === row) return null;
    const ended = this._orderEnded(prev, order, row); // with the S memory of the row that ended
    this._play(order, row);
    if (!this.section || !ended) return null;
    let target = null;
    if (this.next) {
      this.next = false;
      target = this.queue.shift();
    } else {
      const [first, last] = this.sections[this.section];
      // The section's last order ended, or the module left the section: play the next queued
      // section (the rest of a via route), or the same section again.
      if (prev.order === last || order < first || order > last) target = this.queue.shift() ?? this.section;
    }
    return target == null ? null : this._start(target, { order, row });
  }

  _orderEnded(prev, order, row) {
    if (order !== prev.order) {
      this._loops.clear();
      return true;
    }
    if (row === prev.row + 1) {
      this._loops.delete(prev.row); // fell out of any loop on the previous row
      return false;
    }
    const loop = this.info(prev.order, prev.row).loop;
    if (loop) {
      const taken = this._loops.get(prev.row) ?? 0;
      if (taken < loop) {
        this._loops.set(prev.row, taken + 1);
        return false;
      }
      this._loops.delete(prev.row);
    }
    return true;
  }

  _start(name, at) {
    this.section = name;
    this._loops.clear();
    const first = this.sections[name][0];
    if (at && at.order === first && at.row === 0) return { section: name, seek: null };
    this.pos = { order: first, row: 0 };
    this._enter(first, 0);
    return { section: name, seek: { order: first, row: 0 } };
  }

  // The module was moved to order/row: libopenmpt's S memory there, then the row's own commands.
  _enter(order, row) {
    this._memory = this.rowInfo.memoryAt?.(order, row) ?? new Map();
    this._play(order, row);
  }

  _play(order, row) {
    for (const [ch, param] of this.rowInfo(order, row).sets ?? []) this._memory.set(ch, param);
  }
}

const SCRATCH = 1024; // probe output frames per read; the probe's audio is thrown away

/**
 * Renders a module (`mod`) with a muted copy of it (`probe`, same module, same position) and
 * starts sections exactly where `scheduler` says. Both are libopenmpt module pointers; the
 * probe should have every channel muted, which makes it cheap.
 */
export class SectionRenderer {
  constructor(lib, mod, probe, scheduler, rate) {
    Object.assign(this, { lib, mod, probe, scheduler, rate });
    this.tempoFactor = 1;
    this.now = 0;          // frames rendered
    this.rowStart = null;  // frame the playing row started on, when known
    this.rowEnd = null;    // frame the next row starts on, when known
    this.diverged = false; // the probe stopped following the module; it is not used until a seek
    this.scratchL = lib._malloc(4 * SCRATCH);
    this.scratchR = lib._malloc(4 * SCRATCH);
    this.tempoKey = 0;     // 'play.tempo_factor' in WASM memory, for openmpt_module_ctl_get_floatingpoint
    if (lib._openmpt_module_ctl_get_floatingpoint && lib.HEAPU8) {
      const key = new TextEncoder().encode('play.tempo_factor\0');
      this.tempoKey = lib._malloc(key.length);
      lib.HEAPU8.set(key, this.tempoKey);
    }
  }

  dispose() {
    this.lib._free(this.scratchL);
    this.lib._free(this.scratchR);
    if (this.tempoKey) this.lib._free(this.tempoKey);
    this.scratchL = this.scratchR = this.tempoKey = 0;
  }

  /** Both modules go to order/row now; the next frame rendered starts that row. */
  seek(order, row) {
    this.lib._openmpt_module_set_position_order_row(this.mod, order, row);
    this.lib._openmpt_module_set_position_order_row(this.probe, order, row);
    this.scheduler.moved({ order, row });
    this.rowStart = this.now;
    this.rowEnd = null;
    this.diverged = false;
  }

  /** Something moved both modules to a position the renderer cannot time (seconds, subsong). */
  lost() {
    this.scheduler.moved(null);
    this.rowStart = this.rowEnd = null;
  }

  /** Both modules' play.tempo_factor is now `factor`; the playing row can no longer be timed. */
  setTempoFactor(factor) {
    this.tempoFactor = factor;
    this.rowStart = this.rowEnd = null;
  }

  /**
   * Renders up to `frames` frames into the float buffers at leftPtr/rightPtr. Returns { frames,
   * started }: frames rendered (fewer only at the end of the module), and one { section, order,
   * row, frame, seeked, exact } per section start, `frame` being its first frame in the buffer.
   */
  render(leftPtr, rightPtr, frames) {
    const { lib, scheduler } = this;
    const base = this.now, end = base + frames, started = [];
    const readMod = (n) => {
      const off = this.now - base;
      const got = lib._openmpt_module_read_float_stereo(this.mod, this.rate, n, leftPtr + 4 * off, rightPtr + 4 * off);
      this.now += got;
      return got;
    };
    const readProbe = (n) => {
      let left = n;
      while (left > 0) {
        const got = lib._openmpt_module_read_float_stereo(this.probe, this.rate, Math.min(left, SCRATCH), this.scratchL, this.scratchR);
        if (!got) break;
        left -= got;
      }
      return n - left;
    };
    const readBoth = (n) => {
      const got = readMod(n);
      readProbe(got);
      return got;
    };
    // After reads that leave both instances on the same frame: are they on the same row and frame?
    const inStep = () => {
      if (!same(position(lib, this.mod), position(lib, this.probe)) || !this._sameFrame()) this.diverged = true;
      return !this.diverged;
    };

    while (this.now < end) {
      if (this.diverged) {
        // The probe cannot be trusted: play on, and let a seek (a late section change) resync it.
        const pos = position(lib, this.mod);
        if (!readMod(end - this.now)) break;
        if (!same(position(lib, this.mod), pos)) this._late(base, started);
        continue;
      }
      if (this.rowStart === this.now) {
        // A seek: the row's speed and tempo are known once its first frame is rendered.
        if (!readBoth(1)) break;
        inStep();
        continue;
      }
      const pos = position(lib, this.mod);
      if (this.rowEnd !== null && this.rowEnd < this.now) this.rowStart = this.rowEnd = null; // never expected
      if (this.rowEnd === null && this.rowStart !== null) this.rowEnd = this._rowEnd(pos);
      if (this.rowEnd !== null && this.now < this.rowEnd) {
        // Inside a row the clock has timed: render up to its end.
        if (!readBoth(Math.min(end, this.rowEnd) - this.now)) break;
        inStep();
        if (!same(position(lib, this.mod), pos)) this._late(base, started); // the row ended early
        continue;
      }
      if (this.rowEnd === this.now || (this.rowEnd === null && scheduler.exact)) {
        // A prediction is only as good as the probe: check it is in step before using one.
        if (!this._synced(pos)) {
          this.diverged = true;
          continue;
        }
        // The probe renders ahead, frame by frame, until a row starts: at the timed row end,
        // or anywhere up to the end of this buffer for a row the clock could not time.
        const limit = this.rowEnd === this.now ? 1 : end - this.now;
        let ahead = 0, next = null;
        while (ahead < limit && !next) {
          if (!readProbe(1)) break;
          ahead++;
          const p = position(lib, this.probe);
          if (!same(p, pos)) next = p;
        }
        const before = next ? ahead - 1 : ahead; // frames still in the playing row
        if (before && readMod(before) < before) break;
        if (!same(position(lib, this.mod), pos)) {
          // The module left the row before the probe did: the probe is behind it.
          this.diverged = true;
          this._late(base, started);
          continue;
        }
        if (!next) {
          if (!ahead) break;
          this.rowStart = this.rowEnd = null; // no row started where the clock said
          continue;
        }
        const start = scheduler.observe(next.order, next.row);
        const report = start && { section: start.section, ...(start.seek ?? next), frame: this.now - base,
          seeked: !!start.seek, exact: true };
        if (report) started.push(report);
        if (start?.seek) {
          lib._openmpt_module_set_position_order_row(this.mod, start.seek.order, start.seek.row);
          lib._openmpt_module_set_position_order_row(this.probe, start.seek.order, start.seek.row);
          readProbe(1);
        }
        this.rowStart = this.now;
        this.rowEnd = null;
        if (!readMod(1)) break;
        if (!inStep()) {
          // The module did not go where the probe went: whatever was decided here was a guess.
          if (report) report.exact = false;
          scheduler.moved(position(lib, this.mod));
        }
        continue;
      }
      // Nothing to time and nothing to act on: render the rest of the buffer.
      if (!readBoth(end - this.now)) break;
      inStep();
      if (!same(position(lib, this.mod), pos)) this._late(base, started);
    }
    return { frames: this.now - base, started };
  }

  // Same row, frame, speed, tempo and tempo factor in both instances.
  _synced(pos) {
    const { lib, mod, probe, tempoKey } = this;
    return same(position(lib, probe), pos) && this._sameFrame() &&
      lib._openmpt_module_get_current_speed(mod) === lib._openmpt_module_get_current_speed(probe) &&
      lib._openmpt_module_get_current_tempo2(mod) === lib._openmpt_module_get_current_tempo2(probe) &&
      (!tempoKey || lib._openmpt_module_ctl_get_floatingpoint(mod, tempoKey) === lib._openmpt_module_ctl_get_floatingpoint(probe, tempoKey));
  }

  // Both instances have played to the same point: libopenmpt's position in seconds adds up the
  // frames read since the last seek (measured: within 2e-5 of a frame after minutes of reads in
  // different chunk sizes), so it tells how far into the row each one is. Without it, the probe
  // cannot be shown to be in step and is not trusted.
  _sameFrame() {
    const { lib, mod, probe, rate } = this;
    if (!lib._openmpt_module_get_position_seconds) return false;
    return Math.abs(lib._openmpt_module_get_position_seconds(mod) - lib._openmpt_module_get_position_seconds(probe)) * rate < 0.5;
  }

  // Frame the playing row ends on, or null when the clock cannot time it.
  _rowEnd(pos) {
    if (this.tempoFactor !== 1 || this.scheduler.info(pos.order, pos.row).irregular) return null;
    const speed = this.lib._openmpt_module_get_current_speed(this.mod);
    const tempo = this.lib._openmpt_module_get_current_tempo2(this.mod);
    if (!(speed > 0 && tempo > 0)) return null;
    return this.rowStart + speed * Math.floor(this.rate * 2.5 / tempo);
  }

  // A row started inside a chunk: its first frame is unknown, and a section start is late.
  _late(base, started) {
    this.rowStart = this.rowEnd = null;
    const { order, row } = position(this.lib, this.mod);
    const start = this.scheduler.observe(order, row);
    if (!start) return;
    if (start.seek) this.seek(start.seek.order, start.seek.row);
    started.push({ section: start.section, ...(start.seek ?? { order, row }), frame: this.now - base,
      seeked: !!start.seek, exact: false });
  }
}

function position(lib, mod) {
  return { order: lib._openmpt_module_get_current_order(mod), row: lib._openmpt_module_get_current_row(mod) };
}

const same = (a, b) => a.order === b.order && a.row === b.row;
