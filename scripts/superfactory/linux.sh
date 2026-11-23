#!/usr/bin/env bash
# Sets up a Debian/Ubuntu machine for Radio Crestin's Superfactory tasks (superfactory.yaml's setup.linux).
# Open it when a Linux task lacks a tool. Idempotent: each step checks first, so a second run changes nothing.
#
# Installs Python 3.14 with the API's packages (CI's versions), Node 24, the Flutter version mobile/.fvmrc pins,
# JDK 17 and the Android SDK, plus Docker for backend/docker-compose.yaml. System packages need sudo
# (SUPERFACTORY_SETUP_SUDO=1); everything else goes into the user's home, linked from ~/.local/bin.
set -euo pipefail

NODE_MAJOR=24
PYTHON_VERSION=3.14
FLUTTER_VERSION=$(sed -n 's/.*"flutter": *"\([^"]*\)".*/\1/p' mobile/.fvmrc)
ANDROID_SDK="$HOME/Android/Sdk"
ANDROID_PACKAGES=("platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.0.12077973")
CMDLINE_TOOLS_ZIP=commandlinetools-linux-13114758_latest.zip
API_VENV="$HOME/.venvs/radiocrestin-api"
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
export PATH="$BIN:$PATH"

have() { command -v "$1" >/dev/null 2>&1; }
may_sudo() {
  case "${SUPERFACTORY_SETUP_SUDO:-}" in
    1) return 0 ;;
    0) return 1 ;;
    *) sudo -n true 2>/dev/null ;;
  esac
}
link() { ln -sf "$1" "$BIN/$(basename "$1")"; }

install_system_packages() {
  local missing=()
  for pair in git:git curl:curl unzip:unzip xz:xz-utils jq:jq ffmpeg:ffmpeg java:openjdk-17-jdk-headless \
    docker:docker.io clang:clang cmake:cmake ninja:ninja-build pkg-config:pkg-config; do
    have "${pair%%:*}" || missing+=("${pair#*:}")
  done
  # The Flutter Linux desktop target's headers, for `flutter build linux`.
  dpkg -s libgtk-3-dev >/dev/null 2>&1 || missing+=(libgtk-3-dev)
  [ ${#missing[@]} -eq 0 ] && return
  if ! may_sudo; then
    echo "setup: missing ${missing[*]}: run sudo apt-get install -y ${missing[*]}, or allow sudo for setup (machine.setupSudo)" >&2
    exit 1
  fi
  echo "setup: installing ${missing[*]}"
  sudo apt-get update -q
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends "${missing[@]}"
  if [[ " ${missing[*]} " == *" docker.io "* ]]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker-compose-v2 || true
    sudo usermod -aG docker "$USER"
  fi
}

install_node() {
  if have node && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MAJOR" ]; then return; fi
  echo "setup: installing Node $NODE_MAJOR"
  local version dir
  version=$(curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt" | sed -n 's/.*node-\(v[0-9.]*\)-linux-x64.tar.xz/\1/p')
  dir="$HOME/.local/node-$version"
  mkdir -p "$dir"
  curl -fsSL "https://nodejs.org/dist/$version/node-$version-linux-x64.tar.xz" | tar -xJ -C "$dir" --strip-components=1
  for tool in node npm npx; do link "$dir/bin/$tool"; done
}

install_python() {
  have uv || { echo "setup: installing uv"; curl -LsSf https://astral.sh/uv/install.sh | env UV_NO_MODIFY_PATH=1 sh >/dev/null; }
  uv python find "$PYTHON_VERSION" >/dev/null 2>&1 || uv python install "$PYTHON_VERSION"
  [ -x "$API_VENV/bin/python" ] || uv venv --python "$PYTHON_VERSION" "$API_VENV"
  # The API's requirements as its Dockerfile and CI gather them, at the versions constraints.txt pins.
  local requirements
  requirements=$(mktemp)
  cat backend/api/requirements.txt >"$requirements"
  find backend/api/superapp -name requirements.txt -exec sh -c 'echo; cat "$1"' _ {} \; >>"$requirements"
  cat backend/streaming/requirements.txt >>"$requirements"
  echo pytest >>"$requirements"
  VIRTUAL_ENV="$API_VENV" uv pip install -q -r "$requirements" -c backend/api/constraints.txt
  rm -f "$requirements"
  link "$API_VENV/bin/python3.14"
  ln -sf "$API_VENV/bin/python" "$BIN/python-radiocrestin"
}

install_flutter() {
  local dir="$HOME/.local/flutter-$FLUTTER_VERSION"
  if [ ! -x "$dir/bin/flutter" ]; then
    echo "setup: installing Flutter $FLUTTER_VERSION"
    mkdir -p "$dir"
    curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_$FLUTTER_VERSION-stable.tar.xz" |
      tar -xJ -C "$dir" --strip-components=1
  fi
  link "$dir/bin/flutter"
  link "$dir/bin/dart"
  flutter config --no-analytics >/dev/null
  flutter config --android-sdk "$ANDROID_SDK" >/dev/null
}

install_android_sdk() {
  local sdkmanager="$ANDROID_SDK/cmdline-tools/latest/bin/sdkmanager"
  if [ ! -x "$sdkmanager" ]; then
    echo "setup: installing the Android command-line tools"
    local tmp
    tmp=$(mktemp -d)
    curl -fsSL -o "$tmp/tools.zip" "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP"
    unzip -q "$tmp/tools.zip" -d "$tmp"
    mkdir -p "$ANDROID_SDK/cmdline-tools"
    rm -rf "$ANDROID_SDK/cmdline-tools/latest"
    mv "$tmp/cmdline-tools" "$ANDROID_SDK/cmdline-tools/latest"
    rm -rf "$tmp"
  fi
  local missing=()
  for package in "${ANDROID_PACKAGES[@]}"; do
    [ -d "$ANDROID_SDK/${package//;//}" ] || missing+=("$package")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "setup: installing Android ${missing[*]}"
    yes | "$sdkmanager" --sdk_root="$ANDROID_SDK" --licenses >/dev/null || true
    "$sdkmanager" --sdk_root="$ANDROID_SDK" "${missing[@]}" >/dev/null
  fi
  link "$ANDROID_SDK/platform-tools/adb"
}

install_system_packages
install_node
install_python
install_android_sdk
install_flutter
echo "setup: ready (Node $(node --version), Python $("$API_VENV/bin/python" --version | cut -d' ' -f2), Flutter $FLUTTER_VERSION)"
