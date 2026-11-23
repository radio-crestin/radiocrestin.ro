#!/usr/bin/env bash
# Prints a release's notes: one section per app (mobile/, web/, backend/) listing the commits that
# touched its folder since that app's previous release (the newest 20, each cut to one short line),
# or "No changes", with a link to the folder's full diff. The app section also links the listeners'
# notes (mobile/release-notes/<tag>.md) when they exist.
# Usage: scripts/release/notes.sh vX.Y.Z
set -euo pipefail
cd "$(dirname "$0")/../.."

tag="$1"
repo="${GITHUB_REPOSITORY:-radio-crestin/radiocrestin.ro}"
ref="$tag"; git rev-parse -q --verify "refs/tags/$tag" >/dev/null || ref=HEAD

# The folder's previous release: the newest shared vX.Y.Z tag, or before those existed its own
# <folder>/vX.Y.Z tag, that this release contains.
previous_release() {
  local folder="$1" candidate
  for candidate in $(git tag --list 'v[0-9]*' "$folder/v[0-9]*" --sort=-creatordate); do
    [ "$candidate" = "$tag" ] && continue
    git merge-base --is-ancestor "$candidate" "$ref" && { echo "$candidate"; return; }
  done
}

section() {
  local title="$1" folder="$2" previous range total
  previous="$(previous_release "$folder")"
  range="${previous:+$previous..}$ref"
  total="$(git rev-list --no-merges --count "$range" -- "$folder/")"
  printf '## %s\n\n' "$title"
  if [ "$folder" = mobile ] && [ -f "mobile/release-notes/$tag.md" ]; then
    printf "What's new for listeners: [mobile/release-notes/%s.md](https://github.com/%s/blob/%s/mobile/release-notes/%s.md)\n\n" \
      "$tag" "$repo" "$tag" "$tag"
  fi
  if [ "$total" -eq 0 ]; then
    printf 'No changes%s.\n\n' "${previous:+ since $previous}"
    return
  fi
  git log --no-merges -20 --format='%h %s' "$range" -- "$folder/" |
    awk '{ hash = $1; $1 = ""; sub(/^ /, ""); if (length($0) > 110) $0 = substr($0, 1, 107) "..."; print "- " $0 " (" hash ")" }'
  [ "$total" -gt 20 ] && echo "- ...and $((total - 20)) more"
  [ -n "$previous" ] && printf '\n%s changes since %s: https://github.com/%s/compare/%s...%s\n' \
    "$total" "$previous" "$repo" "$previous" "$tag"
  echo
}

section "📱 App" mobile
section "🌐 Website" web
section "🎙️ Backend" backend
