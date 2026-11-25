#!/usr/bin/env bash
# Uploads the large media listed in tools/r2_media.txt (files over the 25 MiB
# Workers asset limit) to the R2 bucket behind https://media.heliobane.gand.games/.
# The object key is the file's path in this repo, so public/trailer.mp4 is served
# at https://media.heliobane.gand.games/public/trailer.mp4.
#
# Uploading is an explicit human step: nothing calls this script, and
# tools/deploy_cloudflare.sh does not touch R2. Run it after committing a new
# encode or press-kit zip (it refuses files that differ from HEAD), before the
# deploy that links to it.
#
# Usage:
#   tools/push_media_r2.sh                         # every file in tools/r2_media.txt
#   tools/push_media_r2.sh public/trailer.mp4      # just these
#   DRY_RUN=1 tools/push_media_r2.sh               # list, upload nothing
#
# Auth: your local wrangler login (`npx wrangler login`). One-time setup, done
# 2026-11-25 (for reference, do not re-run):
#   npx wrangler r2 bucket create heliobane-media
#   npx wrangler r2 bucket domain add heliobane-media \
#     --domain media.heliobane.gand.games --zone-id <gand.games zone id>
#   npx wrangler r2 bucket cors set heliobane-media --file <rules.json>
#     (GET/HEAD from the site: index.html sends a HEAD for the trailer)
#
# A replaced file can stay cached at the edge for up to the max-age below;
# a new file name (and a new line in tools/r2_media.txt) avoids that.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUCKET="heliobane-media"
BASE_URL="https://media.heliobane.gand.games"
export CLOUDFLARE_ACCOUNT_ID="cb007ac207439fd308a2b85acb25a986" # Gand
cd "$ROOT"

# One "path [attachment]" line per file; comments and blank lines skipped.
listed() { grep -v -E '^[[:space:]]*(#|$)' tools/r2_media.txt; }
size() { wc -c < "$1" | tr -d ' '; }

if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  FILES=()
  while read -r path _; do FILES+=("$path"); done < <(listed)
fi

# Preflight: every file listed, present and committed before anything is uploaded.
bad=0
for f in "${FILES[@]}"; do
  if ! listed | awk -v f="$f" '$1==f{found=1} END{exit !found}'; then
    echo "  NOT LISTED $f (add it to tools/r2_media.txt)" >&2; bad=1
  elif [[ ! -f "$f" ]]; then
    echo "  MISSING $f" >&2; bad=1
  elif ! git ls-files --error-unmatch "$f" >/dev/null 2>&1 || ! git diff --quiet HEAD -- "$f"; then
    echo "  NOT COMMITTED $f (commit it first)" >&2; bad=1
  fi
done
(( bad == 0 )) || { echo "push_media_r2.sh: preflight failed; nothing uploaded." >&2; exit 1; }

for f in "${FILES[@]}"; do
  case "$f" in
    *.mp4) type=video/mp4 ;;
    *.zip) type=application/zip ;;
    *) echo "push_media_r2.sh: no content type for $f" >&2; exit 1 ;;
  esac
  disp="inline"
  if listed | awk -v f="$f" '$1==f && $2=="attachment"{found=1} END{exit !found}'; then
    disp="attachment; filename=\"${f##*/}\""
  fi
  printf '  %-55s %4s MB  %s  %s\n' "$f" "$(( $(size "$f") / 1048576 ))" "$type" "$disp"
  [[ -n "${DRY_RUN:-}" ]] && continue
  npx --yes wrangler@4.168.0 r2 object put "$BUCKET/$f" \
    --file "$f" \
    --content-type "$type" \
    --content-disposition "$disp" \
    --cache-control "public, max-age=86400" \
    --remote
done
[[ -n "${DRY_RUN:-}" ]] && { echo "DRY_RUN set: nothing was uploaded."; exit 0; }

# Check what the public URL serves (cache-busted, so the origin) against the file.
echo
fail=0
for f in "${FILES[@]}"; do
  len=$(curl -sfI --max-time 30 "$BASE_URL/$f?cb=$RANDOM$RANDOM" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}' || true)
  if [[ "$len" == "$(size "$f")" ]]; then
    echo "  ok    $BASE_URL/$f"
  else
    echo "  FAIL  $BASE_URL/$f (served ${len:-nothing}, file $(size "$f"))"; fail=1
  fi
done
exit $fail
