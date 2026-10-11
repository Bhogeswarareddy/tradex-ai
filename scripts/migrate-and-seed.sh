#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# One-shot Database Migration and Idempotent Seeding Script
# Supports DRY_RUN=1 mode
# ==============================================================================

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would wait for Postgres to become ready"
    echo "[DRY-RUN] Would run Alembic migrations: alembic upgrade head"
    echo "[DRY-RUN] Would run seed script: python -m app.seed"
    echo "[DRY-RUN] Would run market series generator: python -m app.services.market_data"
    exit 0
fi

echo "==> Running Alembic schema migrations..."
alembic upgrade head

echo "==> Running idempotent base database seed..."
python -m app.seed

echo "==> Ensuring 24-month market intelligence series are populated..."
python -m app.services.market_data

echo "==> Database initialization complete."
