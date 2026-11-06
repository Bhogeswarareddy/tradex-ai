#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TradeX AI — Generate Self-Signed TLS Certificate for Ingress
# Creates 'tradex-tls' Kubernetes Secret in namespace 'tradex'.
# ==============================================================================

CERT_DIR="$(mktemp -d)"
trap 'rm -rf "${CERT_DIR}"' EXIT

KEY_FILE="${CERT_DIR}/tls.key"
CERT_FILE="${CERT_DIR}/tls.crt"

echo "==> Generating self-signed TLS certificate for localhost..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=localhost/O=TradeX AI/C=IN" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null

kubectl create namespace tradex --dry-run=client -o yaml | kubectl apply -f - >/dev/null

echo "==> Storing TLS certificate in Kubernetes Secret 'tradex-tls'..."
kubectl create secret tls tradex-tls \
  --namespace tradex \
  --cert="$CERT_FILE" \
  --key="$KEY_FILE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Successfully created 'tradex-tls' Secret."
