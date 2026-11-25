#!/usr/bin/env bash
# Runs every API test: Django's system check, the pytest tests in tests/ and the apps' Django tests
# (superapp/apps/*/tests: radio_crestin, graphql, storage) against PostgreSQL. CI runs it (.github/workflows/ci.yml).
#
#   backend/api/scripts/test.sh                                   # everything
#   backend/api/scripts/test.sh superapp.apps.radio_crestin.tests.test_forms   # some Django tests only
#
# The Django tests need PostgreSQL (the migrations use its SQL). With DATABASE_URL set (CI's service
# container) it uses that server; without it, it starts a throwaway TimescaleDB container with Docker and
# removes it afterwards. Redis is optional: without REDIS_BROKER_URL the cache is in-process.
# Python: $PYTHON, else the Superfactory venv ~/.venvs/radiocrestin-api, else the active python.
set -euo pipefail
cd "$(dirname "$0")/.."

POSTGRES_IMAGE=${POSTGRES_IMAGE:-timescale/timescaledb:latest-pg16}
if [ -z "${PYTHON:-}" ]; then
  if [ -x "$HOME/.venvs/radiocrestin-api/bin/python" ]; then PYTHON=$HOME/.venvs/radiocrestin-api/bin/python; else PYTHON=python; fi
fi
export SECRET_KEY=${SECRET_KEY:-test-only-not-secret}

if [ -z "${DATABASE_URL:-}" ]; then
  container=$(docker run -d --rm -e POSTGRES_PASSWORD=postgres -p 127.0.0.1::5432 "$POSTGRES_IMAGE")
  trap 'docker rm -f "$container" >/dev/null' EXIT
  port=$(docker port "$container" 5432/tcp | head -1 | sed 's/.*://')
  echo "test: PostgreSQL ($POSTGRES_IMAGE) on 127.0.0.1:$port"
  for _ in $(seq 60); do
    docker exec "$container" pg_isready -q -h 127.0.0.1 -U postgres 2>/dev/null && break
    sleep 1
  done
  export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:$port/postgres"
fi

if [ $# -gt 0 ]; then
  exec "$PYTHON" manage.py test --noinput "$@"
fi
"$PYTHON" manage.py check
"$PYTHON" -m pytest -q tests
"$PYTHON" manage.py test --noinput superapp
