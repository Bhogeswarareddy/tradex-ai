#!/usr/bin/env bash
set -e

PG_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pg_db)
if [ -z "$PG_IP" ]; then
  echo "Error: Could not find IP for pg_db"
  exit 1
fi

export DATABASE_URL="postgresql+asyncpg://tradex_user:tradex_password@${PG_IP}:5432/tradex"
export SYNC_DATABASE_URL="postgresql+psycopg2://tradex_user:tradex_password@${PG_IP}:5432/tradex"
export SECRET_KEY="production-secret-key-tradex-32bytes-secure"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"

/home/devcontainers/.be_venv/bin/alembic "$@"
