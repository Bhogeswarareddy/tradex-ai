#!/bin/sh
set -e

# Ensure certs directory exists
mkdir -p /etc/nginx/certs

# Generate fallback self-signed TLS cert if fullchain.pem or privkey.pem does not exist
if [ ! -f /etc/nginx/certs/fullchain.pem ] || [ ! -f /etc/nginx/certs/privkey.pem ] || [ ! -s /etc/nginx/certs/fullchain.pem ]; then
    echo "Notice: SSL certificates missing or empty in /etc/nginx/certs/. Generating self-signed TLS certificates for localhost..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/privkey.pem \
        -out /etc/nginx/certs/fullchain.pem \
        -subj "/C=US/ST=State/L=City/O=TradeX/OU=Engineering/CN=localhost" 2>/dev/null || true
fi

exec "$@"
