# HELIOBANE (Amiga): animated screenshots for itch.io

For the screenshot column of coze.itch.io/heliobane-amiga. Made 2026-10-28. Checked by Codex (tincan `codex`): every
decoded frame equals its source crop, exact ×2, colours, sizes, delays, loops; its factual findings (the first cut
flew with godmode, a beam misnamed, the collapse misdescribed) are fixed here.

**Source.** The Amiga fast build, heliobane-amiga main `3ca1aab` (with the fast build's late-frames fix), built in a
scratch copy (`make VARIANT=fast stage`). Each scene is the `stage` program flying a stage with the stage's own
autoplay input (the bot's recorded input in the stage pack, as the repo's gates fly it), on Copperline, headless and
silent, every frame dumped. `mortal=1` flies that input without godmode (the recorded bot's default is godmode), so
hits cost what they cost. `raster=0` turns off the harness's CPU-time raster bar; nothing else is changed.
`skip=N` flies the first N ticks of the stage unseen to reach a scene sooner (the harness's option, not in the release
game); everything shown is played and drawn by the game.

    VARIANT=fast CL_ARGS="--dump-frames DIR --dump-start S --dump-count N" \
      emu/cl-run.sh stage stage=K [skip=T] raster=0 mortal=1

**Frames.** Copperline's frames are the picture at exactly ×2. The GIFs crop the PAL window (320×256 Amiga pixels,
640×512) and nothing is rescaled. Each GIF's palette is built from the clip's own colours (65 to 198), so no colour is
merged and there is no dithering: every decoded frame matches Copperline's pixel for pixel. The game runs at 50
frames a second; the GIFs keep every 2nd frame (40 ms), real time, to stay under itch's 3 MB.

| GIF | run, frames | what it shows | frames × delay | size |
|---|---|---|---|---|
| heliobane-focus-storm | stage 5, skip=4300, from 20 s, frames 140-289 | a spiral bullet storm in Aurel's Corona; focus slow-motion greys the backdrop in pulses (the sidebar bar and the ring on the ship with it) | 75 × 40 ms = 3.00 s | 2.74 MB |
| heliobane-heart-eye-beam | stage 5, skip=20380, from 24 s, frames 570-749 | the Herald, the Hungering Heart, in its collapse phase: its eye's beam sweeping down through a dense pattern | 90 × 40 ms = 3.60 s | 2.79 MB |
| heliobane-heart-collapses | the same run, frames 0-149 | its lower spire bursts and the Heart enters its collapse phase: THE HEART COLLAPSES | 75 × 40 ms = 3.00 s | 2.41 MB |
| heliobane-the-seed | stage 10, skip=13000, frames 520-719 | World 2's Herald, the Seed, whole, and its fan patterns | 100 × 40 ms = 4.00 s | 2.21 MB |

Each `.png` is one frame of its scene at the same 640×512. `contact_sheet.png` shows four frames of each GIF.
Tools (git-ignored, heliobane-amiga/.scratch/itch-gifs/): `ffgif_exact.sh` (ffmpeg with a palette made of the clip's
colours, paletteuse dither=none diff_mode=rectangle).
