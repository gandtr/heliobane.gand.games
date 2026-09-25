# HELIOBANE: Steam graphical assets

Full game AppID **5328670**, demo AppID **5328700** (store item 1343621).
Sizes are Steamworks' current ones (Store Assets / Library Assets pages, 2026).

## Full game (5328670)

| File | Steamworks slot | Size |
|---|---|---|
| `steam/header_capsule.png` | Store Assets → Header Capsule | 920×430 |
| `steam/small_capsule.png` | Store Assets → Small Capsule | 462×174 |
| `steam/main_capsule.png` | Store Assets → Main Capsule | 1232×706 |
| `steam/vertical_capsule.png` | Store Assets → Vertical Capsule | 748×896 |
| `steam/page_background.png` | Store Assets → Page Background | 1438×810 |
| `steam/library_capsule.png` | Library Assets → Library Capsule | 600×900 |
| `steam/library_header.png` | Library Assets → Library Header | 920×430 |
| `steam/library_hero.png` | Library Assets → Library Hero (no text, no logo) | 3840×1240 |
| `steam/library_logo.png` | Library Assets → Library Logo (transparent PNG) | 1280×720 |
| `steam/community_icon.jpg` | Installation → Client Images → Community Icon | 184×184 |
| `steam/client_icon.ico` | Installation → Client Images → Client Icon | 16 + 32 (.ico) |
| `steam/client_image_16.tga` | Installation → Client Images → Client Image (if asked) | 16×16 |
| `steam/linux_icons.zip` | Installation → Client Images → Linux Client Icons | 16, 24, 32, 48, 64, 96, 128, 256 |
| `steam/client_icon_32.png` | the client icon as PNG, for reference | 32×32 |
| `steam/event_cover.png` | Events & Announcements → Cover image | 800×450 |
| `steam/event_header.png` | Events & Announcements → Header image | 1920×622 |
| `steam-screenshots/01…12_*.png` | Store Assets → Screenshots (upload in this order) | 1920×1080 each |

Library logo placement: the logo is the in-game logo at ×5 (1210×320),
centred on the transparent 1280×720. In the library logo editor, put it
top-left, over the dark sky left of the sun (the bottom edge of the hero is
fire and crystal). The hero keeps the eye in the centre third so it survives
every crop.

## Demo (5328700)

Same slots, with **FREE DEMO** where Steam allows text: the capsules and the
library capsule/header. The hero and logo are the full game's (Steam forbids
text on the hero; the logo is the name).

| File | Steamworks slot | Size |
|---|---|---|
| `steam/demo/header_capsule.png` | Header Capsule | 920×430 |
| `steam/demo/small_capsule.png` | Small Capsule | 462×174 |
| `steam/demo/main_capsule.png` | Main Capsule | 1232×706 |
| `steam/demo/vertical_capsule.png` | Vertical Capsule | 748×896 |
| `steam/demo/library_capsule.png` | Library Capsule | 600×900 |
| `steam/demo/library_header.png` | Library Header | 920×430 |
| `steam/demo/library_hero.png` | Library Hero (same as the full game) | 3840×1240 |
| `steam/demo/library_logo.png` | Library Logo (same as the full game) | 1280×720 |
| page background, icons | reuse the full game's files | |

Demo screenshots: `steam-screenshots/demo/01…08_*.png` (1920×1080), all from
World 1 stages 1–3: Admiral Husk, the Breaker, the Quarry Maw, the Magpie,
Leviathan Choir, the Tharsis Belt, the Hollow Fleet, a flare. If the demo
grows to stages 1–5, add `steam-screenshots/04_hungering_heart.png`.

## Steam screenshots (1920×1080)

Pure gameplay, no added text. Each is the game's 320×256 frame at ×4
(1280×1024) centred on black: exactly what the game shows full-screen on a
1080p monitor with its integer scaling.

| # | File | What it shows |
|---|---|---|
| 1 | `01_admiral_husk.png` | Stage 3 Herald, Admiral Husk |
| 2 | `02_breaker.png` | the Breaker column into the Corvette Husk (stage 3) |
| 3 | `03_quarry_maw.png` | Stage 1 Herald, the Quarry Maw |
| 4 | `04_hungering_heart.png` | Stage 5 Herald, the Hungering Heart |
| 5 | `05_the_magpie.png` | Old Mott's shop, second-gun slot |
| 6 | `06_storm_choir.png` | Stage 8 Herald, the Storm Choir |
| 7 | `07_the_valve.png` | Stage 12 Herald, the Valve |
| 8 | `08_leviathan_choir.png` | Stage 2 Herald, Leviathan Choir |
| 9 | `09_stalwart.png` | Stage 9 Herald, the Stalwart |
| 10 | `10_the_orrery.png` | Stage 13 Herald, the Orrery |
| 11 | `11_halvards_rings.png` | Stage 7 ice terrain and the Ice Shepherd |
| 12 | `12_the_cantor.png` | Stage 14 Herald, the Cantor |

The final Herald (the First Mouth) is left out of the Steam set on purpose;
it is in `screenshots/` for coverage that wants it.

## Checks done

- Sizes: every file matches the table (checked by script).
- Palette: every capsule and library PNG uses only the game's 32 colours.
- Pixel scaling: integer nearest-neighbour only. Capsules use ×2 or ×3 of a
  native canvas, key art ×4, library hero ×4, library logo ×5.
- Legibility: the small capsule was checked at 462×174 and at 231×87 (its
  1× display size); the logo reads at both.
