#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Database & Document Volume Backup Script
# Creates timestamped compressed backups, prunes to keep last 7, copies to S3 if set
# Supports DRY_RUN=1 mode
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DB_CONTAINER="${DB_CONTAINER:-pg_db}"
POSTGRES_USER="${POSTGRES_USER:-tradex_user}"
POSTGRES_DB="${POSTGRES_DB:-tradex}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Backup timestamp: ${TIMESTAMP}"
    echo "[DRY-RUN] Target local directory: ${BACKUP_DIR}"
    echo "[DRY-RUN] Would run: docker exec ${DB_CONTAINER} pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} | gzip > ${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
    echo "[DRY-RUN] Would archive uploads volume: docker run --rm -v tradex_uploads:/data -v $(pwd)/${BACKUP_DIR}:/backup alpine tar czf /backup/uploads_${TIMESTAMP}.tar.gz -C /data ."
    echo "[DRY-RUN] Would prune local backups keeping newest 7"
    if [[ -n "${S3_BUCKET_NAME}" ]]; then
        echo "[DRY-RUN] Would copy backups to s3://${S3_BUCKET_NAME}/backups/"
    fi
    exit 0
fi

mkdir -p "${BACKUP_DIR}"

echo "==> 1. Creating compressed PostgreSQL dump from ${DB_CONTAINER}..."
docker exec "${DB_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

echo "==> 2. Archiving trade documents uploads volume..."
docker run --rm \
    -v tradex_uploads:/data \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/uploads_${TIMESTAMP}.tar.gz" -C /data .

echo "==> 3. Pruning old backups (keeping newest 7)..."
# shellcheck disable=SC2012
ls -t "${BACKUP_DIR}"/db_*.sql.gz | tail -n +8 | xargs -r rm -f
# shellcheck disable=SC2012
ls -t "${BACKUP_DIR}"/uploads_*.tar.gz | tail -n +8 | xargs -r rm -f

# Copy to S3 if bucket is configured
if [[ -n "${S3_BUCKET_NAME}" ]] && command -v aws >/dev/null 2>&1; then
    echo "==> 4. Syncing backup archives to Amazon S3: s3://${S3_BUCKET_NAME}/backups/..."
    aws s3 cp "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz" "s3://${S3_BUCKET_NAME}/backups/"
    aws s3 cp "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" "s3://${S3_BUCKET_NAME}/backups/"
fi

echo "==> Backup completed successfully at ${TIMESTAMP}."
