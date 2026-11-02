#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Production Deployment Script for Amazon EC2 Host (Free Tier Optimized)
# Supports DRY_RUN=1 mode
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/tradex-ai}"
COMPOSE_FILE="${COMPOSE_FILE:-${APP_DIR}/docker-compose.free.yml}"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
    COMPOSE_FILE="${APP_DIR}/docker-compose.prod.yml"
fi

TAG_FILE="${APP_DIR}/.previous_tag"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Deploying IMAGE_TAG=${IMAGE_TAG} to ${APP_DIR}"
    echo "[DRY-RUN] Using compose file: ${COMPOSE_FILE}"
    echo "[DRY-RUN] Would fetch secrets from AWS SSM Parameter Store (/tradex/prod/*) into .env (chmod 600)"
    echo "[DRY-RUN] Would ensure TLS certificates exist in certs/"
    echo "[DRY-RUN] Would record previous tag from ${TAG_FILE} for rollback safety"
    echo "[DRY-RUN] Would build/pull container images: docker compose -f ${COMPOSE_FILE} build"
    echo "[DRY-RUN] Would start database: docker compose -f ${COMPOSE_FILE} up -d db"
    echo "[DRY-RUN] Would run database migrations: docker compose -f ${COMPOSE_FILE} run --rm migrate"
    echo "[DRY-RUN] Would start production services: docker compose -f ${COMPOSE_FILE} up -d"
    echo "[DRY-RUN] Would verify health check: curl -k -f https://localhost/api/health"
    echo "[DRY-RUN] Would provision admin user using SSM password"
    exit 0
fi

cd "${APP_DIR}"

# Track previous tag for rollback
if [[ -f "${TAG_FILE}" ]]; then
    PREV_TAG="$(cat "${TAG_FILE}")"
    echo "==> Current active image tag: ${PREV_TAG}"
else
    PREV_TAG="latest"
    echo "latest" > "${TAG_FILE}"
fi

# Ensure certificates exist for Nginx TLS termination
if [[ ! -f "${APP_DIR}/certs/fullchain.pem" || ! -f "${APP_DIR}/certs/privkey.pem" ]]; then
    echo "==> Generating baseline TLS certificates..."
    bash "${APP_DIR}/scripts/gen-self-signed-cert.sh"
fi

# Fetch secrets securely via EC2 Instance IAM Role
echo "==> Reading configuration from AWS Systems Manager Parameter Store..."
SSM_SECRET_KEY=$(aws ssm get-parameter --name "/tradex/prod/secret_key" --with-decryption --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "tradex-secret-key-32bytes-secure")
SSM_GROQ_KEY=$(aws ssm get-parameter --name "/tradex/prod/groq_api_key" --with-decryption --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "")
SSM_ADMIN_EMAIL=$(aws ssm get-parameter --name "/tradex/prod/admin_email" --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "admin@tradex.ai")
SSM_ADMIN_PASS=$(aws ssm get-parameter --name "/tradex/prod/admin_password" --with-decryption --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "Admin123$")
SSM_PG_PASS=$(aws ssm get-parameter --name "/tradex/prod/postgres_password" --with-decryption --region "${AWS_REGION}" --query "Parameter.Value" --output text 2>/dev/null || echo "tradex_prod_password")

cat << EOF > .env
ENV=production
DEBUG=false
SECRET_KEY=${SSM_SECRET_KEY}
GROQ_API_KEY=${SSM_GROQ_KEY}
POSTGRES_DB=tradex
POSTGRES_USER=tradex_user
POSTGRES_PASSWORD=${SSM_PG_PASS}
DATABASE_URL=postgresql+asyncpg://tradex_user:${SSM_PG_PASS}@db:5432/tradex
SYNC_DATABASE_URL=postgresql+psycopg2://tradex_user:${SSM_PG_PASS}@db:5432/tradex
ADMIN_BOOTSTRAP_EMAIL=${SSM_ADMIN_EMAIL}
ADMIN_BOOTSTRAP_PASSWORD=${SSM_ADMIN_PASS}
WORKER_INLINE=true
EMBEDDINGS_ENABLED=false
DEMO_MODE=true
LOCAL_STORAGE_PATH=/app/storage
CORS_ORIGINS=["http://localhost","https://localhost","http://127.0.0.1","https://127.0.0.1"]
EOF

chmod 600 .env

echo "==> Building microservice container images..."
docker compose -f "${COMPOSE_FILE}" build

echo "==> Starting database container..."
docker compose -f "${COMPOSE_FILE}" up -d db

echo "==> Waiting for database readiness..."
sleep 6

echo "==> Running database migrations and demo seed..."
docker compose -f "${COMPOSE_FILE}" run --rm migrate

echo "==> Starting production stack..."
docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Waiting for production service health checks to pass..."
MAX_RETRIES=20
COUNT=0
HEALTHY=0

while [[ $COUNT -lt $MAX_RETRIES ]]; do
    if curl -k -s -f "https://localhost/api/health" | grep -q "healthy"; then
        HEALTHY=1
        break
    fi
    echo "Waiting for backend & nginx health... ($((COUNT+1))/${MAX_RETRIES})"
    sleep 5
    COUNT=$((COUNT+1))
done

if [[ $HEALTHY -eq 1 ]]; then
    echo "IMAGE_TAG=${IMAGE_TAG}" > "${TAG_FILE}"
    echo "==> Deployment SUCCESSFUL. Active Tag: ${IMAGE_TAG}"
    
    echo "==> Ensuring administrator is provisioned via CLI with SSM password..."
    docker compose -f "${COMPOSE_FILE}" exec -T backend python -m app.cli create-admin --force || true

    docker compose -f "${COMPOSE_FILE}" ps
else
    echo "==> Healthcheck FAILED! Initiating rollback to previous tag: ${PREV_TAG}..."
    IMAGE_TAG="${PREV_TAG}" docker compose -f "${COMPOSE_FILE}" up -d
    exit 1
fi
