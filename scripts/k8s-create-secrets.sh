#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TradeX AI — Generate Kubernetes Secrets from Untracked .env
# Never prints secrets to stdout or commits them to Git.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env file not found at ${ENV_FILE}" >&2
  echo "Please create .env before running this script." >&2
  exit 1
fi

echo "==> Reading credentials from untracked .env..."

# Parse .env safely
get_env_val() {
  local key="$1"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" | cut -d '=' -f 2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  echo "$val"
}

SECRET_KEY=$(get_env_val "SECRET_KEY")
POSTGRES_DB=$(get_env_val "POSTGRES_DB")
POSTGRES_USER=$(get_env_val "POSTGRES_USER")
POSTGRES_PASSWORD=$(get_env_val "POSTGRES_PASSWORD")
GROQ_API_KEY=$(get_env_val "GROQ_API_KEY")

POSTGRES_DB="${POSTGRES_DB:-tradex}"
POSTGRES_USER="${POSTGRES_USER:-tradex_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-tradex_password}"
SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}"
GROQ_API_KEY="${GROQ_API_KEY:-}"

DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
SYNC_DATABASE_URL="postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"

# Ensure namespace exists
kubectl create namespace tradex --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "==> Creating or updating 'tradex-secrets' in namespace 'tradex'..."
kubectl create secret generic tradex-secrets \
  --namespace tradex \
  --from-literal="SECRET_KEY=${SECRET_KEY}" \
  --from-literal="POSTGRES_DB=${POSTGRES_DB}" \
  --from-literal="POSTGRES_USER=${POSTGRES_USER}" \
  --from-literal="POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  --from-literal="DATABASE_URL=${DATABASE_URL}" \
  --from-literal="SYNC_DATABASE_URL=${SYNC_DATABASE_URL}" \
  --from-literal="GROQ_API_KEY=${GROQ_API_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Successfully created 'tradex-secrets' (values masked)."
