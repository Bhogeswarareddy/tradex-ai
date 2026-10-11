#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Generate Self-Signed TLS Certificates for Local HTTPS Development
# Supports DRY_RUN=1 mode
# ==============================================================================

CERT_DIR="${CERT_DIR:-certs}"
DAYS_VALID="${DAYS_VALID:-365}"
DOMAIN="${DOMAIN:-localhost}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would create directory: ${CERT_DIR}"
    echo "[DRY-RUN] Would generate self-signed TLS cert for ${DOMAIN} (valid ${DAYS_VALID} days)"
    echo "[DRY-RUN] Targets: ${CERT_DIR}/privkey.pem and ${CERT_DIR}/fullchain.pem"
    exit 0
fi

echo "==> Creating certificate directory: ${CERT_DIR}"
mkdir -p "${CERT_DIR}"

if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
    echo "==> Existing TLS certificates found in ${CERT_DIR}. Preserving."
    exit 0
fi

echo "==> Generating 2048-bit RSA private key and self-signed certificate for ${DOMAIN}..."
openssl req -x509 -nodes -days "${DAYS_VALID}" -newkey rsa:2048 \
    -keyout "${CERT_DIR}/privkey.pem" \
    -out "${CERT_DIR}/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=TradeX AI/OU=Engineering/CN=${DOMAIN}"

chmod 600 "${CERT_DIR}/privkey.pem"
chmod 644 "${CERT_DIR}/fullchain.pem"

echo "==> Self-signed certificate generated successfully:"
echo "    - Fullchain: ${CERT_DIR}/fullchain.pem"
echo "    - Private Key: ${CERT_DIR}/privkey.pem"
