#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Initialize Let's Encrypt TLS Certificate via Certbot on AWS EC2
# Supports DRY_RUN=1 mode
# ==============================================================================

DOMAIN="${DOMAIN:-api.tradex.ai}"
EMAIL="${EMAIL:-admin@tradex.ai}"
STAGING="${STAGING:-0}"
CERT_DIR="${CERT_DIR:-certs}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would initialize Certbot for domain: ${DOMAIN} (email: ${EMAIL})"
    echo "[DRY-RUN] Staging mode: ${STAGING}"
    echo "[DRY-RUN] Would run: docker run --rm -v $(pwd)/certs:/etc/letsencrypt -v $(pwd)/certbot_www:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email"
    exit 0
fi

echo "==> Requesting Let's Encrypt TLS certificate for domain: ${DOMAIN}..."

STAGING_FLAG=""
if [[ "${STAGING}" == "1" ]]; then
    STAGING_FLAG="--staging"
fi

mkdir -p "${CERT_DIR}" ./certbot_www

docker run --rm \
    -v "$(pwd)/${CERT_DIR}:/etc/letsencrypt" \
    -v "$(pwd)/certbot_www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    ${STAGING_FLAG}

# Symlink or copy to expected paths
if [[ -d "${CERT_DIR}/live/${DOMAIN}" ]]; then
    cp -L "${CERT_DIR}/live/${DOMAIN}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
    cp -L "${CERT_DIR}/live/${DOMAIN}/privkey.pem" "${CERT_DIR}/privkey.pem"
    echo "==> Production certificates linked to ${CERT_DIR}/fullchain.pem and privkey.pem"
fi

echo "==> TLS setup complete."
