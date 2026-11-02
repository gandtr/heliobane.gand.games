/**
 * CozyScore — a soundtrack of several modules for the web, one module audible at a time.
 *
 *   const score = new CozyScore();   // inside a user gesture: it opens the AudioContext
 *   await score.cue('title.it');     // the first cue starts at once
 *   score.cue('stage1.it');          // later cues switch on the playing module's next bar line
 *
 * Where CozyAdaptive moves between sections of one module, CozyScore moves between
 * modules: a site or game whose songs are separate .it/.mod files (horizontal
 * re-sequencing). Two decks (ChiptuneJsPlayer worklets on one AudioContext) take turns.
 * A cue fetches its module (cached), loads it on the idle deck held at its start, and
 * waits for the playing module to reach a bar line: a row that is a multiple of
 * `quantum` (16 by default, a 4/4 bar at four rows a beat). There the new module starts
 * from order 0, row 0 and the old one fades out over `fadeOut` seconds. If no bar line
 * comes within `maxWait` ms (odd pattern lengths, long row delays), the switch happens then.
 *
 * The latest cue wins: a cue made while another waits replaces it (the replaced cue
 * resolves false), and a cue for the module already playing cancels the wait.
 *
 * The bar line is read from the worklet's position reports, so a switch lands within one
 * render quantum (128 frames) of the line, not on its exact frame; the crossfade hides that.
 * Loading a module runs on the audio thread, so cues are loaded ahead of their bar line
 * rather than on it.
 */
import { ChiptuneJsPlayer } from './vendor/chiptune3/chiptune3.js';

export class CozyScore {
  /**
   * opts: context (an AudioContext to share; otherwise one is opened and closed by dispose),
   * volume (0..1, default 1), quantum (rows, default 16), fadeIn / fadeOut (seconds, default
   * 0.02 / 1), maxWait (ms, default 4000), timeout (ms a load may take, default 15000).
   * Tests pass createPlayer(context) and fetch(url, signal) → Promise<ArrayBuffer>.
   */
  constructor(opts = {}) {
    const g = globalThis;
    if (!opts.createPlayer && (!g.isSecureContext || !('audioWorklet' in (g.AudioContext?.prototype ?? {})))) {
      throw new Error('audio needs a secure context (HTTPS or localhost) with AudioWorklet');
    }
    this.quantum = opts.quantum ?? 16;
    this.fadeIn = opts.fadeIn ?? 0.02;
    this.fadeOut = opts.fadeOut ?? 1;
    this.maxWait = opts.maxWait ?? 4000;
    this.timeout = opts.timeout ?? 15000;
    // Construct before any await so the AudioContext is created inside the user gesture.
    this.context = opts.context ?? new AudioContext();
    this._ownsContext = !opts.context;
    this._createPlayer = opts.createPlayer ?? ((context) => new ChiptuneJsPlayer({ repeatCount: -1, context }));
    this._fetch = opts.fetch ?? fetchModule;
    this.master = this.context.createGain();
    this.master.gain.value = opts.volume ?? 1;
    this.master.connect(this.context.destination);

    this.url = null;        // the module audible now (or last, while paused)
    this.playing = true;
    this._live = null;      // its deck
    this._pending = null;   // the cue waiting for a bar line
    this._buffers = new Map();
    this._changeCbs = [];
    this._progressCbs = [];
    this._decks = [this._deck(), this._deck()];
  }

  /**
   * Play `url` next. Resolves true when it starts, false when a later cue replaced it;
   * rejects when it cannot load (the playing module carries on).
   */
  cue(url) {
    if (this._disposed) return Promise.reject(new Error('score disposed'));
    if (this._pending?.url === url) return this._pending.promise;
    this._drop(this._pending);
    if (this._live && this.url === url) return Promise.resolve(true);

    const pending = { url, deck: this._decks.find((d) => d !== this._live), loaded: false };
    pending.promise = new Promise((resolve, reject) => { pending.resolve = resolve; pending.reject = reject; });
    this._pending = pending;
    this._load(pending).then(() => {
      if (this._pending !== pending) return;
      pending.loaded = true;
      pending.deadline = now() + this.maxWait;
      if (!this._live || !this.playing) this._switch();
    }, (e) => {
      if (this._pending !== pending) return;
      this._pending = null;
      pending.reject(e);
    });
    return pending.promise;
  }

  /** Fetch a module ahead of its cue. */
  prefetch(url) { this._buffer(url).catch(() => {}); return this; }

  /** Called with the url of each module as it starts. */
  onChange(cb) { this._changeCbs.push(cb); return this; }
  /** The audible module's position reports: { order, row, pos, vu: [{ left, right }] }. */
  onProgress(cb) { this._progressCbs.push(cb); return this; }

  pause() { this.playing = false; this.context.suspend?.(); return this; }
  resume() { this.playing = true; this.context.resume?.(); return this; }

  /** Master volume 0..1, optionally ramped over `seconds`. */
  setVolume(v, seconds = 0) {
    rampTo(this.master.gain, this.context.currentTime, Math.max(0, Math.min(1, v)), seconds);
    return this;
  }

  /** Stop and release audio resources; closes the AudioContext the score opened. */
  dispose() {
    this._disposed = true;
    this._drop(this._pending);
    this._changeCbs = [];
    this._progressCbs = [];
    for (const deck of this._decks) {
      clearTimeout(deck.fadeTimer);
      try { deck.player.stop?.(); } catch { /* already gone */ }
      try { deck.player.processNode?.disconnect(); } catch { /* not connected */ }
      try { deck.gain.disconnect(); } catch { /* not connected */ }
    }
    if (this._ownsContext && this.context.state !== 'closed') this.context.close?.().catch(() => {});
  }

  // --- internals -------------------------------------------------------------
  _deck() {
    const player = this._createPlayer(this.context);
    const gain = this.context.createGain();
    gain.gain.value = 0;
    player.gain.connect(gain);
    gain.connect(this.master);
    const deck = { player, gain, url: null, lastOrder: -1, lastRow: -1, fading: null, fadeTimer: null, waiting: null, busy: Promise.resolve() };
    deck.ready = new Promise((resolve, reject) => {
      player.onInitialized(resolve);
      player.onError((e) => reject(new Error(`audio worklet failed to load (${e?.type ?? 'error'})`)));
    });
    deck.ready.catch(() => {});
    // chiptune3 handlers cannot be removed, so one handler per event forwards to the current waiter.
    player.onMetadata((m) => deck.waiting?.resolve(m));
    player.onError((e) => deck.waiting?.reject(new Error(`module failed to load (${e?.type ?? 'error'})`)));
    player.onProgress((d) => this._progress(deck, d));
    return deck;
  }

  _buffer(url) {
    let buf = this._buffers.get(url);
    if (!buf) {
      buf = withTimeout(this._fetch(url), this.timeout, `${url} did not load`);
      buf.catch(() => this._buffers.delete(url));
      this._buffers.set(url, buf);
    }
    return buf;
  }

  async _load(pending) {
    const { deck, url } = pending;
    const buf = await this._buffer(url);
    await withTimeout(deck.ready, this.timeout, 'audio worklet did not load');
    // One load at a time per deck, so a replaced cue's module cannot answer for the next one.
    const run = deck.busy.then(async () => {
      await deck.fading; // let a fading module finish before its deck takes the next one
      if (this._pending !== pending || deck.url === url) return; // replaced, or still held at its start
      deck.url = null;
      const loaded = new Promise((resolve, reject) => { deck.waiting = { resolve, reject }; });
      // Held paused at the start until its bar line; the worklet copies the buffer.
      deck.player.play(buf);
      deck.player.pause();
      try {
        await withTimeout(loaded, this.timeout, `${url} did not start`);
      } finally {
        deck.waiting = null;
      }
      deck.url = url;
    });
    deck.busy = run.catch(() => {});
    await run;
  }

  _progress(deck, d) {
    const boundary = d.row % this.quantum === 0 && (d.row !== deck.lastRow || d.order !== deck.lastOrder);
    deck.lastOrder = d.order;
    deck.lastRow = d.row;
    if (deck !== this._live) return;
    for (const cb of this._progressCbs) cb(d);
    const p = this._pending;
    if (p?.loaded && this.playing && (boundary || now() >= p.deadline)) this._switch();
  }

  _switch() {
    const p = this._pending;
    this._pending = null;
    const t = this.context.currentTime;
    const incoming = p.deck;
    const outgoing = this._live;
    clearTimeout(incoming.fadeTimer);
    incoming.lastOrder = incoming.lastRow = -1;
    incoming.player.setOrderRow(0, 0);
    incoming.player.unpause();
    rampTo(incoming.gain.gain, t, 1, this.fadeIn, 0);
    if (outgoing) {
      // Paused, the old deck can go quiet at once; playing, it fades and then stops rendering.
      const fade = this.playing ? this.fadeOut : 0;
      rampTo(outgoing.gain.gain, t, 0, fade);
      outgoing.fading = new Promise((resolve) => {
        outgoing.fadeTimer = setTimeout(() => {
          outgoing.player.pause();
          outgoing.fading = null;
          resolve();
        }, fade * 1000 + 50);
      });
    }
    this._live = incoming;
    this.url = p.url;
    for (const cb of this._changeCbs) cb(p.url);
    p.resolve(true);
  }

  _drop(pending) {
    if (!pending) return;
    if (this._pending === pending) this._pending = null;
    pending.resolve(false);
  }
}

const now = () => globalThis.performance?.now?.() ?? Date.now();

// From the param's current value (or `from`) to `to`, linearly over `seconds` from time t.
function rampTo(param, t, to, seconds, from = param.value) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(from, t);
  if (seconds > 0) param.linearRampToValueAtTime(to, t + seconds);
  else param.setValueAtTime(to, t);
}

function withTimeout(promise, ms, message) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${message} within ${ms} ms`)), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function fetchModule(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}
