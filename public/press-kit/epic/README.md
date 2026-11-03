# HELIOBANE: Epic Games Store images

Sizes are the Epic Developer Portal's (Storefront Media Guide, 2026).

| File | Developer Portal slot | Size |
|---|---|---|
| `epic/offer_wide.png` | Epic Games Store → Offers → **HELIOBANE** (base game) → Images → Landscape (general) | 2560×1440 |
| `epic/demo/offer_wide.png` | Epic Games Store → Offers → **HELIOBANE Demo** → Images → Landscape (general) | 2560×1440 |

The other offer images stay as they are: Portrait 1200×1600 (base game and
demo), Product Logo 960×540 transparent PNG, the 512×512 icon. All were
checked against the guide on 2026-10-27 and meet it. The library images can
keep their own landscape, or take the new one with the portal's "copy general
images to library" option.

## Why these two

The landscape offer image is the store page's link preview: Epic puts the
base game's landscape image in `og:image` and `twitter:image` on
store.epicgames.com/p/heliobane-ad6470, and the demo offer's landscape image on
/p/heliobane-heliobane-demo-c2ee19. Bluesky, X, Facebook and LinkedIn show it
centre-cropped to 1.91:1; Discord and Slack show it whole.

Both are the sun-eye painting with the eye right of centre, the logo centred
across the top over the sun's rim, and HB-0 (with a drone and an orbiter) at the
bottom centre firing the Breaker straight up into the logo's O (2026-11-03; the
Steam main capsule, the itch.io cover and the Play feature graphic share it). Epic's guide shows its example logo in the middle of the image;
here the logo is centred left to right but sits in the top third, so it does
not cover the eye. Epic also recommends the offer type on demo images, hence
**FREE DEMO** on the demo's, bottom right beside the ship (Epic adds no demo mark
of its own; Steam does, so the Steam demo capsule has no badge). Logo and badge sit inside the centred 2:1
crop, so every link card keeps them.

How they were made: the sun-eye painting cropped around the pupil (the
pupil 74% across and 58% down the frame, the crop as large as the painting's
right edge allows), reduced to a 427×240 native canvas in the game's 32-colour
palette with the intro's dither, the in-game logo drawn at 1.25× natively and
centred 17 px from the top, HB-0 and its pods at 2× at the bottom centre with
the Breaker's column (drawn as the game draws it) from just above the nose up to
the O, thinning out as it reaches the logo, the demo badge (the game's gold title
font on its panel) 18 px in from the bottom right corner; then the whole ×6 nearest-neighbour and
cropped to 2560×1440. No other resampling.

## Social preview

The portal also has an optional **Social preview** image (Pages → Product home
or an offer → Optional information), 1200×1200 JPG. Leave it empty: it would
become the link preview in place of the landscape image (the guide says it shows
with any link to the product), and a square image loses its top and bottom
quarter in a 1.91:1 card.
