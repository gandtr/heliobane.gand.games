# PROJECT.md — HELIOBANE.GAND.GAMES

The official page for **HELIOBANE**, an Amiga-style vertical shoot 'em up in
development at Gand, published under [Gand Games](https://gand.games/).

- Address: `https://heliobane.gand.games/` (`CNAME`)
- Hosting: GitHub Pages, `main` branch, repository root, same as the Aldith and
  Studs Up sites. `.nojekyll` is present.
- DNS: CNAME `heliobane` → `gandtr.github.io` (not set up yet; the site owner manages DNS).
- No framework, build step, external fonts or third-party scripts.

## Structure

```
index.html                  The whole site: markup, one <style>, one vanilla-JS IIFE
CNAME, robots.txt, sitemap.xml, .nojekyll
.htmlvalidate.json          html-validate:recommended (run: npx --yes html-validate@9 index.html)
.claude/launch.json         local preview on :8141
public/
  og.png                    1200x630 social card (400x210 composed at 1x, scaled x3 nearest)
  favicon.ico, favicon-64.png, apple-touch-icon.png   from the ship sprite (player_ship frame 2)
  trailer-poster.jpg        1920x1080 PLACEHOLDER poster (title screen, 320x180 crop x6)
  trailer.mp4               NOT PRESENT YET (see Trailer)
  shots/<name>.png          960x768 captures (the game's own x3 output) for the viewer / full size
  shots/1x/<name>.png       320x256, centre-sampled from the captures; shown at x1/x2 with pixelated scaling
  art/                      game art copied unchanged: logo, intro paintings (aurel, wren),
                            portraits (mott, wren), sprites (ship, flame, pods, Quarry Maw, enemy orb),
                            field.png (240x512 slice of stage1_far), trailer-still.png (320x180)
  fonts/                    Public Pixel (CC0), Fira Sans Condensed (OFL), PixelMplus12 subset (M+ licence)
```

## Design notes

- Colour: only the game's 32-colour master palette (`assets/palette.hex`), as CSS
  variables at the top of the stylesheet. Copper bars are stepped palette ramps.
- Type: Public Pixel on its 8 px grid (16/24/32 px) for display and labels, 8 px only
  for figure captions; Fira Sans Condensed for body text; PixelMplus12 (12/24/36 px)
  for Japanese display, system Japanese sans for Japanese body text.
- Pixel art is only ever shown at whole-number scales (x1, x2, x3; `image-rendering:
  pixelated`). The hero painting is x3 (x2 below 1180 px) and fades out in eight
  steps where the page runs past it. The viewer shows the x3 capture at x3, the 1x
  file at x2, and a smooth fit only when the screen is narrower than 640 px.
- Motion (all off under `prefers-reduced-motion`): logo drop and two shine sweeps,
  the copper bar under the hero colour-cycles, and the Breaker demo runs only while
  on screen.

## Languages

English and Japanese live side by side in the markup (`.l-en` / `.l-ja`); the
`EN / 日本語` switch sets `html[data-lang]`, `lang`, the title and the image alt text
(`data-alt-ja`). The choice is stored in `localStorage` (`hb-lang`); `?lang=ja`
forces Japanese; a `ja` browser language picks it by default. Japanese terms follow
the game's `i18n/ja.json` (ヘリオベイン, マグパイ号, オールド・モット, ヘラルド,
ブレイカー, オーラム, 嬢ちゃん, stage and world names).

**After editing any Japanese text, re-subset the pixel font** (it only contains the
glyphs the page uses):

```sh
python3 -c "s=open('index.html').read();print(''.join(sorted(set(c for c in s if ord(c)>0x2FFF)))+'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:;!?()-/&+・·、。「」（）！？：　〜×')" > /tmp/ja.txt
pyftsubset ~/projects/games/heliobane/art/src/fonts/ja/PixelMplus12-Regular.ttf \
  --text-file=/tmp/ja.txt --flavor=woff2 --output-file=public/fonts/PixelMplus12-ja.woff2
```

## Content sources (do not invent)

All facts come from the game repository `~/projects/games/heliobane` at commit
`667d2af`: `README.md`, `docs/GDD.md` (pitch, pillars, weapons, damage types,
materials, heat/graze/Breaker, Heralds, difficulty, lineage, resolution),
`docs/LORE.md` (Aurel, the Umbrine, Oda Venn, Wren, Old Mott, world and Herald
descriptions, the Oda quote), `docs/worlds.md` and `data/worlds.json` (three worlds of
five stages, World 2 and 3 stage tech), `docs/intro.md` (intro narration languages),
and `i18n/{en,ja}.json` (names and Japanese wording).

Not announced anywhere, so not on the page: release date, price, platforms, Steam
link, review quotes. The Steam button is a placeholder `<a>` with no `href`
("Free demo coming to Steam", per the coordinator: a free demo of stages 1–3 is
being prepared; no link or date yet).

## Screenshots

Captured on 2026-09-25 from an isolated snapshot, never from the working tree (other
agents edit that repository; keep it read-only):

```sh
git -C ~/projects/games/heliobane archive 667d2af | tar -x -C <snap>
godot --headless --path <snap> --import
cd <snap>
KIT="--weapon=pulse --level=4 --front2=lance:3 --rear=tail --pod_l=drone --pod_r=orbiter"
tools/offscreen.sh -- --shot=/abs/<name>.png <args>
```

`tools/offscreen.sh` is the game's headless cage + Mesa llvmpipe + Dummy audio
wrapper: no window, no sound, no GPU. Each capture is 960x768 (x3 of 320x256).

| File | Arguments |
|---|---|
| tharsis-belt | `--stage=1 --at=45 --seed=1 --godmode $KIT` |
| quarry-maw | `--stage=1 --boss=quarrymaw --phase=1 --at=6 --seed=1 --godmode $KIT` |
| leviathan-choir | `--stage=2 --boss=leviathan --phase=1 --at=6 --seed=1 --godmode $KIT` |
| admiral-husk | `--stage=3 --boss=husk --phase=2 --at=6 --seed=1 --godmode $KIT` |
| cinder-crown | `--stage=4 --at=75 --seed=1 --godmode $KIT` |
| hungering-heart | `--stage=5 --boss=heart --phase=1 --at=6 --seed=1 --godmode $KIT` |
| aurels-corona | `--stage=5 --at=75 --seed=1 --godmode $KIT` |
| ashfall-drift | `--stage=6 --at=75 --seed=1 --godmode $KIT` |
| halvards-rings | `--stage=7 --at=130 --seed=1 --godmode $KIT` |
| stormglass | `--stage=8 --at=130 --seed=1 --godmode $KIT` |
| the-vein | `--stage=12 --at=130 --seed=1 --godmode $KIT` |
| choirnest | `--stage=14 --at=130 --seed=1 --godmode $KIT` |
| first-mouth | `--stage=15 --at=130 --seed=1 --godmode $KIT` |
| magpie | `--screen=shop --at=3` |
| title (poster, still) | `--screen=title --at=3` |

The game renders at the window size, so some layers sit on third-pixels in the 960x768
capture. The 1x files take the centre pixel of every 3x3 block. `og.png`,
`trailer-poster.jpg` and `art/trailer-still.png` are nearest-neighbour integer scales
of 1x material.

## Trailer

The `<video>` in `#trailer` points at `public/trailer.mp4` with
`poster="public/trailer-poster.jpg"`, `preload="none"`, native controls. Drop in:

- `public/trailer.mp4` (H.264/AAC MP4, 16:9)
- `public/trailer-poster.jpg` (1920x1080, replaces the placeholder)

No HTML edit is needed. On load, the script sends a `HEAD` for `trailer.mp4`; while it
is missing (or not served as `video/*`), the page hides the video and the hero's
"Watch the trailer" button and shows the native title-screen still at a whole-pixel
scale with a "Trailer incoming" label. The pending state logs one expected 404 in the
console. Without JavaScript the video element shows its poster and controls. Once the
trailer exists, consider adding it to the JSON-LD (`trailer` VideoObject) and optional
captions (`<track>`), as on the Studs Up site.

## Validation done

html-validate@9 clean; every `public/` reference resolves; checked in a browser at
1440, 1280, 390/375 and 360 px (no horizontal scroll), EN and JA, the viewer with
mouse, arrow keys and Escape (focus returns to the thumbnail), and the trailer both
missing and present (a temporary MP4).
