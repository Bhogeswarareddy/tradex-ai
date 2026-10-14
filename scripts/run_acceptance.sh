#!/usr/bin/env bash
set -e

# Dynamically discover pg_db container IP
PG_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pg_db)
if [ -z "$PG_IP" ]; then
  echo "Error: Could not find IP for pg_db"
  exit 1
fi

echo "Connecting to PostgreSQL at $PG_IP:5432..."
export DATABASE_URL="postgresql+asyncpg://tradex_user:tradex_password@${PG_IP}:5432/tradex"
export SYNC_DATABASE_URL="postgresql+psycopg2://tradex_user:tradex_password@${PG_IP}:5432/tradex"
export SECRET_KEY="production-secret-key-tradex-32bytes-secure"
export RATE_LIMIT_AUTH=1000

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../backend"
TEST_TARGET="${*:-app/tests/test_catalogue_acceptance.py}"
/home/devcontainers/.be_venv/bin/pytest $TEST_TARGET -v
