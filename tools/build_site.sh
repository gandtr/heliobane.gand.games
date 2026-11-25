#!/usr/bin/env bash
# Builds the public site into _site/ for the heliobane-gand-games Worker.
# Until 2026-11-25 GitHub Pages published the repository root of main as is
# (legacy branch build, .nojekyll). This copies only the site itself, from the
# committed tree (git archive), so untracked local files and the repo's own
# files (PROJECT.md, tests/, tools/, CNAME, dotfiles) never ship.
# The files in tools/r2_media.txt are too big for Workers static assets
# (25 MiB per file): they are left out here, served from R2, and _redirects
# sends their old paths there.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
media_base="https://media.heliobane.gand.games"
src="$(mktemp -d)"
trap 'rm -rf "$src"' EXIT
git -C "$repo" archive HEAD | tar -x -C "$src"
cd "$src"
mkdir _site
# A file on this line that does not exist fails the build.
cp -r index.html privacy public robots.txt sitemap.xml _site/
while read -r path _; do
  case "$path" in ''|'#'*) continue ;; esac
  test -f "_site/$path" || { echo "::error::$path (tools/r2_media.txt) is not in the site"; exit 1; }
  rm "_site/$path"
  printf '/%s %s/%s 301\n' "$path" "$media_base" "$path" >> _site/_redirects
done < tools/r2_media.txt
test -s _site/index.html || { echo "::error::_site/index.html missing"; exit 1; }
big="$(find _site -type f -size +25M)"
if [ -n "$big" ]; then
  echo "::error::over the 25 MiB Workers asset limit; add to tools/r2_media.txt and push to R2:"
  echo "$big"
  exit 1
fi
rm -rf "$repo/_site"
mv _site "$repo/_site"
echo "built $repo/_site from $(git -C "$repo" rev-parse --short HEAD): $(find "$repo/_site" -type f | wc -l) files, $(du -sh "$repo/_site" | cut -f1)"
