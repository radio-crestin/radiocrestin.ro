#!/usr/bin/env bash
# Prints a release's notes for the website and the backend (and the app, with --app): the commits
# that touched each folder since the previous release (the newest 20, each cut to one short
# line), then a link to the full diff.
# Usage: scripts/release/notes.sh vX.Y.Z [--app]
set -euo pipefail
cd "$(dirname "$0")/../.."

tag="$1"
with_app="${2:-}"
repo="${GITHUB_REPOSITORY:-radio-crestin/radiocrestin.ro}"
ref="$tag"; git rev-parse -q --verify "refs/tags/$tag" >/dev/null || ref=HEAD
# The app's releases before the shared version were tagged mobile/vX.Y.Z.
previous="$(git tag --list 'v[0-9]*' 'mobile/v[0-9]*' --sort=-creatordate | grep -vxF "$tag" | head -1 || true)"
range="${previous:+$previous..}$ref"

section() {
  local title="$1" folder="$2" total
  total="$(git rev-list --no-merges --count "$range" -- "$folder/")"
  [ "$total" -eq 0 ] && return 0
  printf '## %s\n\n' "$title"
  git log --no-merges -20 --format='%h %s' "$range" -- "$folder/" |
    awk '{ hash = $1; $1 = ""; sub(/^ /, ""); if (length($0) > 110) $0 = substr($0, 1, 107) "..."; print "- " $0 " (" hash ")" }'
  [ "$total" -gt 20 ] && echo "- ...and $((total - 20)) more"
  echo
}

[ "$with_app" = "--app" ] && section "📱 App" mobile
section "🌐 Website" web
section "🎙️ Backend" backend
[ -n "$previous" ] && echo "**Full diff:** https://github.com/$repo/compare/$previous...$tag"
exit 0
