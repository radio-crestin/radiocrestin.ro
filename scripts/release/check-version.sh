#!/usr/bin/env bash
# Fails when web/package.json or mobile/pubspec.yaml disagree with VERSION (CI runs it).
set -euo pipefail
cd "$(dirname "$0")/../.."

version="$(cat VERSION)"
web="$(node -p 'require("./web/package.json").version')"
app="$(awk '/^version:/ {print $2}' mobile/pubspec.yaml)"
app="${app%%+*}"

if [ "$web" != "$version" ] || [ "$app" != "$version" ]; then
  echo "VERSION is $version, but web/package.json has $web and mobile/pubspec.yaml has $app." >&2
  echo "Set all three with scripts/release/bump.sh." >&2
  exit 1
fi
echo "Every app is at $version"
