#!/usr/bin/env bash
# Sets up a Mac for Radio Crestin's Apple tasks in Superfactory (superfactory.yaml's setup.macos): iOS, macOS
# and Apple TV builds. Open it when a Mac task lacks a tool. Idempotent: each step checks first.
#
# Xcode comes with the machine's image. This adds the Flutter version mobile/.fvmrc pins and CocoaPods,
# linked from ~/.local/bin. The backend, the website and Android stay on the Linux machine.
set -euo pipefail

FLUTTER_VERSION=$(sed -n 's/.*"flutter": *"\([^"]*\)".*/\1/p' mobile/.fvmrc)
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
export PATH="$BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"

have() { command -v "$1" >/dev/null 2>&1; }
link() { ln -sf "$1" "$BIN/$(basename "$1")"; }

if ! xcode-select -p >/dev/null 2>&1; then
  echo "setup: Xcode is missing: this machine needs an image with Xcode (runner.macos.goldenBase)" >&2
  exit 1
fi

install_flutter() {
  local dir="$HOME/.local/flutter-$FLUTTER_VERSION"
  if [ ! -x "$dir/bin/flutter" ]; then
    echo "setup: installing Flutter $FLUTTER_VERSION"
    local arch tmp
    arch=$([ "$(uname -m)" = arm64 ] && echo arm64_ || echo "")
    tmp=$(mktemp -d)
    curl -fsSL -o "$tmp/flutter.zip" \
      "https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_${arch}$FLUTTER_VERSION-stable.zip"
    unzip -q "$tmp/flutter.zip" -d "$tmp"
    rm -rf "$dir"
    mv "$tmp/flutter" "$dir"
    rm -rf "$tmp"
  fi
  link "$dir/bin/flutter"
  link "$dir/bin/dart"
  flutter config --no-analytics >/dev/null
}

install_cocoapods() {
  have pod && return
  if ! have brew; then
    echo "setup: CocoaPods is missing and Homebrew isn't here: install one of them" >&2
    exit 1
  fi
  echo "setup: installing CocoaPods"
  brew install cocoapods >/dev/null
}

install_flutter
install_cocoapods
echo "setup: ready (Flutter $FLUTTER_VERSION, CocoaPods $(pod --version), $(xcodebuild -version | head -1))"
