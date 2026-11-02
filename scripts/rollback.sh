#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Automated Rollback Script for TradeX AI
# Supports DRY_RUN=1 mode
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/tradex-ai}"
COMPOSE_FILE="${APP_DIR}/docker-compose.free.yml"
TAG_FILE="${APP_DIR}/.previous_tag"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Target directory: ${APP_DIR}"
    echo "[DRY-RUN] Would inspect previous tag in ${TAG_FILE}"
    echo "[DRY-RUN] Would restart services with: docker compose -f ${COMPOSE_FILE} up -d"
    echo "[DRY-RUN] Would verify health check: curl -k -f https://localhost/api/health"
    exit 0
fi

cd "${APP_DIR}"
if [[ ! -f "${TAG_FILE}" ]]; then
    echo "ERROR: No previous tag recorded in ${TAG_FILE}. Cannot rollback." >&2
    exit 1
fi

ROLLBACK_TAG="$(cat "${TAG_FILE}")"
echo "==> Initiating rollback to previous tag: ${ROLLBACK_TAG}..."
IMAGE_TAG="${ROLLBACK_TAG}" docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Verifying service health post-rollback..."
sleep 5
if curl -k -s -f "https://localhost/api/health" | grep -q "healthy"; then
    echo "==> Rollback to ${ROLLBACK_TAG} SUCCESSFUL."
else
    echo "==> Rollback verification FAILED." >&2
    exit 1
fi
