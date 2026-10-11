#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Production Deployment Script for Amazon EC2 Host
# Pulls ECR images, loads SSM secrets, runs migrations, verifies health, tracks rollback tag
# Supports DRY_RUN=1 mode
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/tradex-ai}"
TAG_FILE="${APP_DIR}/.previous_tag"
COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Deploying IMAGE_TAG=${IMAGE_TAG} to ${APP_DIR}"
    echo "[DRY-RUN] Would fetch secrets from AWS SSM Parameter Store (/tradex/prod/*) into .env"
    echo "[DRY-RUN] Would record previous tag from ${TAG_FILE} for rollback safety"
    echo "[DRY-RUN] Would run: docker compose -f ${COMPOSE_FILE} pull"
    echo "[DRY-RUN] Would run one-shot database migration: docker compose -f ${COMPOSE_FILE} run --rm migrate"
    echo "[DRY-RUN] Would run: docker compose -f ${COMPOSE_FILE} up -d"
    echo "[DRY-RUN] Would verify health check: curl -k -f https://localhost/api/health"
    exit 0
fi

cd "${APP_DIR}"

# Track previous tag for rollback
if [[ -f "${TAG_FILE}" ]]; then
    PREV_TAG="$(cat "${TAG_FILE}")"
    echo "==> Current active image tag: ${PREV_TAG}"
else
    echo "latest" > "${TAG_FILE}"
fi

# Fetch secrets securely via EC2 Instance IAM Role (least privilege)
if command -v aws >/dev/null 2>&1 && [[ -n "${FETCH_SSM_SECRETS:-}" ]]; then
    echo "==> Reading configuration from AWS Systems Manager Parameter Store..."
    aws ssm get-parameters-by-path --path "/tradex/prod/" --with-decryption --region "${AWS_REGION}" --query "Parameters[*].[Name,Value]" --output text | while read -r name val; do
        var_name="${name##*/}"
        echo "${var_name}=${val}" >> .env
    done
fi

echo "==> Pulling container images from Amazon ECR for tag: ${IMAGE_TAG}..."
docker compose -f "${COMPOSE_FILE}" pull

echo "==> Running database migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm migrate

echo "==> Starting production services..."
docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Waiting for service health checks to pass..."
MAX_RETRIES=15
COUNT=0
HEALTHY=0

while [[ $COUNT -lt $MAX_RETRIES ]]; do
    if curl -k -s -f "https://localhost/api/health" | grep -q "healthy"; then
        HEALTHY=1
        break
    fi
    echo "Waiting for backend & nginx health... ($((COUNT+1))/${MAX_RETRIES})"
    sleep 4
    COUNT=$((COUNT+1))
done

if [[ $HEALTHY -eq 1 ]]; then
    echo "IMAGE_TAG=${IMAGE_TAG}" > "${TAG_FILE}"
    echo "==> Deployment SUCCESSFUL. Active Tag: ${IMAGE_TAG}"
    docker compose -f "${COMPOSE_FILE}" ps
else
    echo "==> Healthcheck FAILED! Initiating rollback to previous tag: ${PREV_TAG:-latest}..."
    IMAGE_TAG="${PREV_TAG:-latest}" docker compose -f "${COMPOSE_FILE}" up -d
    exit 1
fi
