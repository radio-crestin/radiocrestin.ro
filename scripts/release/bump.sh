#!/usr/bin/env bash
# Sets the one version every app shares: VERSION, web/package.json and mobile/pubspec.yaml.
# Usage: scripts/release/bump.sh patch|minor|major|X.Y.Z   (the app's build number goes up by one)
set -euo pipefail
cd "$(dirname "$0")/../.."

current="$(cat VERSION)"
IFS=. read -r major minor patch <<< "$current"
case "${1:-}" in
  patch) next="$major.$minor.$((patch + 1))" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  major) next="$((major + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) next="$1" ;;
  *) echo "usage: $0 patch|minor|major|X.Y.Z" >&2; exit 1 ;;
esac

echo "$next" > VERSION
(cd web && npm version "$next" --no-git-tag-version --allow-same-version >/dev/null)
build="$(awk -F+ '/^version:/ {print $2}' mobile/pubspec.yaml)"
sed -i.bak "s/^version: .*/version: $next+$((build + 1))/" mobile/pubspec.yaml && rm mobile/pubspec.yaml.bak

echo "$current -> $next (app build $((build + 1)))"
