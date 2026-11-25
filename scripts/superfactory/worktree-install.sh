#!/usr/bin/env bash
# Installs each new Superfactory worktree's dependencies (superfactory.yaml's install), from the shared caches.
# Open it when a task's worktree is missing packages. The website's npm packages and the app's Dart packages.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

have() { command -v "$1" >/dev/null 2>&1; }

# The Mac only builds the Apple apps: the website installs on Linux.
if [ "$(uname)" = Linux ] && have npm; then
  (cd web && npm ci --prefer-offline --no-audit --no-fund)
fi
if have flutter; then
  (cd mobile && flutter pub get)
fi

# The Android SDK for `flutter build apk`: where setup put it, even for a session user whose HOME and
# flutter config differ from the machine's. Gradle reads sdk.dir from android/local.properties.
android_sdk() {
  local dir adb
  for dir in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" "$HOME/android-sdk" \
    "$HOME/Library/Android/sdk"; do
    [ -n "$dir" ] && [ -d "$dir/platform-tools" ] && { echo "$dir"; return; }
  done
  adb=$(command -v adb 2>/dev/null) || return 1
  adb=$(readlink -f "$adb" 2>/dev/null || realpath "$adb" 2>/dev/null) || return 1
  dir=$(dirname "$(dirname "$adb")")
  [ -d "$dir/platforms" ] && echo "$dir"
}
properties=mobile/android/local.properties
if sdk=$(android_sdk) && ! grep -q '^sdk.dir=' "$properties" 2>/dev/null; then
  # Flutter writes the file without a final newline.
  [ -s "$properties" ] && [ -n "$(tail -c1 "$properties")" ] && echo >>"$properties"
  echo "sdk.dir=$sdk" >>"$properties"
fi
