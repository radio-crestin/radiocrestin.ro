#!/usr/bin/env bash
# Creates or reuses the backend's Python venvs: ~/.venvs/radiocrestin-api (the API's requirements as its
# Dockerfile and CI gather them, at constraints.txt's versions, plus pytest) and ~/.venvs/radiocrestin-streaming.
# Run by linux.sh (machine setup) and worktree-install.sh (each task's worktree), from the repo root.
# Open it when a task lacks ~/.venvs/radiocrestin-api. Idempotent: a venv whose requirements did not change
# since its last install (a hash stamp in the venv) is reused as it is.
set -euo pipefail

PYTHON_VERSION=3.14
API_VENV="$HOME/.venvs/radiocrestin-api"
STREAMING_VENV="$HOME/.venvs/radiocrestin-streaming"
BIN="$HOME/.local/bin"
mkdir -p "$BIN"
export PATH="$BIN:$PATH"

command -v uv >/dev/null 2>&1 || {
  echo "setup: installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_NO_MODIFY_PATH=1 UV_INSTALL_DIR="$BIN" sh >/dev/null
}
uv python find "$PYTHON_VERSION" >/dev/null 2>&1 || uv python install "$PYTHON_VERSION"

# make_venv <venv> <requirements file> [uv pip install arguments...]
make_venv() {
  local venv=$1 requirements=$2
  shift 2
  local stamp arg
  stamp=$(for arg in "$requirements" "$@"; do [ -f "$arg" ] && cat "$arg" || echo "$arg"; done | sha256sum | cut -d' ' -f1)
  if [ -x "$venv/bin/python" ] && [ "$(cat "$venv/.radiocrestin-stamp" 2>/dev/null)" = "$stamp" ]; then return; fi
  echo "setup: installing $venv"
  [ -x "$venv/bin/python" ] || uv venv -q --python "$PYTHON_VERSION" "$venv"
  VIRTUAL_ENV="$venv" uv pip install -q -r "$requirements" "$@"
  echo "$stamp" >"$venv/.radiocrestin-stamp"
}

requirements=$(mktemp)
trap 'rm -f "$requirements"' EXIT
{
  cat backend/api/requirements.txt
  find backend/api/superapp -name requirements.txt | sort | while read -r f; do echo; cat "$f"; done
  echo pytest
} >"$requirements"
make_venv "$API_VENV" "$requirements" -c backend/api/constraints.txt
# Streaming pins other versions (requests) than the API's constraints: a venv of its own.
{ cat backend/streaming/requirements.txt; echo; echo pytest; } >"$requirements"
make_venv "$STREAMING_VENV" "$requirements"

ln -sf "$API_VENV/bin/python3.14" "$BIN/python3.14"
# Wrappers, not symlinks: Python finds its venv from the path it is started by, so a link elsewhere runs bare.
for name in api:"$API_VENV" streaming:"$STREAMING_VENV"; do
  rm -f "$BIN/python-radiocrestin-${name%%:*}"
  printf '#!/bin/sh\nexec "%s/bin/python" "$@"\n' "${name#*:}" >"$BIN/python-radiocrestin-${name%%:*}"
  chmod +x "$BIN/python-radiocrestin-${name%%:*}"
done
