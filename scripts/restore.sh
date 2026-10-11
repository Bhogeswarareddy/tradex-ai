#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Database & Document Volume Restore Script
# Restores PostgreSQL database and tradex_uploads volume from compressed backups
# Usage: ./scripts/restore.sh [TIMESTAMP]
# If no TIMESTAMP is provided, restores the most recent backup in backups/
# Supports DRY_RUN=1 mode
# ==============================================================================

BACKUP_DIR="${BACKUP_DIR:-backups}"
DB_CONTAINER="${DB_CONTAINER:-pg_db}"
POSTGRES_USER="${POSTGRES_USER:-tradex_user}"
POSTGRES_DB="${POSTGRES_DB:-tradex}"

TARGET_TIMESTAMP="${1:-}"

if [[ -z "${TARGET_TIMESTAMP}" ]]; then
    # Pick the latest backup
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        TARGET_TIMESTAMP="latest_simulated"
        DB_BACKUP="${BACKUP_DIR}/db_${TARGET_TIMESTAMP}.sql.gz"
        UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TARGET_TIMESTAMP}.tar.gz"
    else
        LATEST_DB=$(ls -t "${BACKUP_DIR}"/db_*.sql.gz 2>/dev/null | head -n 1 || true)
        if [[ -z "${LATEST_DB}" ]]; then
            echo "Error: No backup archives found in ${BACKUP_DIR}/" >&2
            exit 1
        fi
        DB_BACKUP="${LATEST_DB}"
        TARGET_TIMESTAMP=$(basename "${LATEST_DB}" | sed -e 's/^db_//' -e 's/\.sql\.gz$//')
        UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TARGET_TIMESTAMP}.tar.gz"
    fi
else
    # Strip prefixes or extensions if provided directly as filename or timestamp
    CLEAN_TS=$(basename "${TARGET_TIMESTAMP}" | sed -e 's/^db_//' -e 's/^uploads_//' -e 's/\.sql\.gz$//' -e 's/\.tar\.gz$//')
    DB_BACKUP="${BACKUP_DIR}/db_${CLEAN_TS}.sql.gz"
    UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${CLEAN_TS}.tar.gz"
fi

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Restore target timestamp: ${TARGET_TIMESTAMP}"
    echo "[DRY-RUN] Database backup source: ${DB_BACKUP}"
    echo "[DRY-RUN] Uploads backup source: ${UPLOADS_BACKUP}"
    echo "[DRY-RUN] Would run: gunzip -c ${DB_BACKUP} | docker exec -i ${DB_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
    echo "[DRY-RUN] Would restore uploads volume using alpine container tar extraction"
    exit 0
fi

if [[ ! -f "${DB_BACKUP}" ]]; then
    echo "Error: Database backup file '${DB_BACKUP}' not found." >&2
    exit 1
fi

echo "==> Restoring from backup timestamp: ${TARGET_TIMESTAMP}"

echo "==> 1. Restoring PostgreSQL database into ${DB_CONTAINER}..."
gunzip -c "${DB_BACKUP}" | docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

if [[ -f "${UPLOADS_BACKUP}" ]]; then
    echo "==> 2. Restoring trade documents into tradex_uploads volume..."
    docker run --rm \
        -v tradex_uploads:/data \
        -v "$(pwd)/${BACKUP_DIR}:/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "${UPLOADS_BACKUP}") -C /data"
else
    echo "Notice: Uploads archive '${UPLOADS_BACKUP}' not found; skipped documents volume restore."
fi

echo "==> Restore completed successfully."
