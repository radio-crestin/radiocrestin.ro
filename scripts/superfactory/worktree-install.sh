#!/usr/bin/env bash
# Installs each new Superfactory worktree's dependencies (superfactory.yaml's install), from the shared caches.
# Open it when a task's worktree is missing packages. The website's npm packages, the app's Dart packages and,
# on Linux, the backend's Python venvs (created, or reused when their requirements did not change).
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

have() { command -v "$1" >/dev/null 2>&1; }

# The Mac only builds the Apple apps: the website installs on Linux.
if [ "$(uname)" = Linux ] && have npm; then
  (cd web && npm ci --prefer-offline --no-audit --no-fund)
fi
if [ "$(uname)" = Linux ]; then
  bash scripts/superfactory/python-venvs.sh
fi
if have flutter; then
  (cd mobile && flutter pub get)
fi
