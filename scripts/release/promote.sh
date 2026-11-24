#!/usr/bin/env bash
# Turns a prerelease into a release. Refuses one without its narrated video (make release-video).
# It becomes "latest" only when the app's downloads are attached, so
# /releases/latest/download/<file> keeps serving an app build.
# Usage: scripts/release/promote.sh vX.Y.Z
set -euo pipefail

tag="$1"
repo="${GH_REPO:-radio-crestin/radiocrestin.ro}"
assets="$(gh release view "$tag" -R "$repo" --json assets -q '.assets[].name')"

if ! grep -qx 'radio-crestin-whats-new.mp4' <<< "$assets"; then
  echo "$tag has no video yet: run make release-video first" >&2
  exit 1
fi

if grep -qx 'radio-crestin-android.apk' <<< "$assets"; then
  gh release edit "$tag" -R "$repo" --prerelease=false --latest
  echo "Released, and latest: https://github.com/$repo/releases/latest"
else
  gh release edit "$tag" -R "$repo" --prerelease=false --latest=false
  echo "Released without the app's downloads, so the previous app release stays latest:"
  echo "https://github.com/$repo/releases/tag/$tag"
fi
