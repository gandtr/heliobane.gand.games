#!/usr/bin/env bash
# Build the committed tree and deploy it to the heliobane-gand-games Worker
# (heliobane.gand.games). Uses your local wrangler login; run `npx wrangler login`
# once if it asks. Commit first: uncommitted changes are not deployed.
# Large media is not part of this: see tools/push_media_r2.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
tools/build_site.sh
npx --yes wrangler@4.168.0 deploy
