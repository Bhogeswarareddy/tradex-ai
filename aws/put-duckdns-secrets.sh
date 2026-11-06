#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"

echo "======================================================================"
echo "TradeX AI — DuckDNS Configuration (AWS SSM SecureString)"
echo "======================================================================"
echo "Secrets typed here are hidden and stored directly in AWS SSM Parameter Store."
echo ""

read -p "Enter DuckDNS Subdomain (e.g., mytradex for mytradex.duckdns.org): " DUCKDNS_SUBDOMAIN
# Strip any .duckdns.org suffix if user typed the full name
DUCKDNS_SUBDOMAIN="${DUCKDNS_SUBDOMAIN%.duckdns.org}"

read -s -p "Enter DuckDNS Token (hidden): " DUCKDNS_TOKEN
echo ""

if [[ -z "${DUCKDNS_SUBDOMAIN}" || -z "${DUCKDNS_TOKEN}" ]]; then
    echo "ERROR: Subdomain and token cannot be empty."
    exit 1
fi

echo "Storing in AWS SSM Parameter Store (${REGION})..."

/home/devcontainers/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/duckdns_subdomain" \
    --value "${DUCKDNS_SUBDOMAIN}" \
    --type "String" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

/home/devcontainers/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/duckdns_token" \
    --value "${DUCKDNS_TOKEN}" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

echo ""
echo "==> DuckDNS configuration successfully stored in AWS SSM!"
echo "    Domain: https://${DUCKDNS_SUBDOMAIN}.duckdns.org"
