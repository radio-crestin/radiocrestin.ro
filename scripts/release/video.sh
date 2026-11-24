#!/usr/bin/env bash
# Gives a release its narrated video: builds it from mobile/release-notes/<tag>.md (slides, Kokoro
# narration; mobile/release-notes/README.md), attaches the video, its poster and the slides, and
# rewrites the release's notes to open with the video. Every release gets one: promote.sh refuses a
# release without it. Runs on a Mac with Chrome, ffmpeg and bun; unchanged slides are reused.
# Usage: scripts/release/video.sh vX.Y.Z
set -euo pipefail
cd "$(dirname "$0")/../.."

tag="$1"
repo="${GH_REPO:-radio-crestin/radiocrestin.ro}"
dist=mobile/dist

gh release view "$tag" -R "$repo" >/dev/null || { echo "No release $tag yet: run make release first" >&2; exit 1; }
make -C mobile release-media TAG="$tag"
gh release upload "$tag" -R "$repo" --clobber \
  "$dist/radio-crestin-whats-new.mp4" "$dist/radio-crestin-whats-new.jpg" "$dist/radio-crestin-whats-new.html"

notes="$(mktemp)"; trap 'rm -f "$notes"' EXIT
{
  (cd mobile/scripts/release-media && bun src/main.ts notes "$tag" --repo "$repo")
  echo
  scripts/release/notes.sh "$tag"
} > "$notes"
gh release edit "$tag" -R "$repo" --notes-file "$notes"
echo "Video: https://www.radiocrestin.ro/video/?tag=$tag"
