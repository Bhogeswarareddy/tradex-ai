#!/usr/bin/env bash
# setup-dev.sh: Initialize local development environment
set -e

echo "=== TradeX AI Developer Environment Setup ==="

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would create .env from .env.example and validate docker compose config"
    exit 0
fi

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Building and validating Docker Compose multi-container stack..."
docker compose config > /dev/null

echo "Setup complete! Run 'docker compose up --build' to start TradeX AI."
