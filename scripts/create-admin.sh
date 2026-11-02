#!/usr/bin/env bash
set -euo pipefail

cd /opt/tradex-ai

ADMIN_EMAIL=$(aws ssm get-parameter --name "/tradex/prod/admin_email" --region ap-south-1 --query "Parameter.Value" --output text --no-cli-pager)
ADMIN_PASS=$(aws ssm get-parameter --name "/tradex/prod/admin_password" --with-decryption --region ap-south-1 --query "Parameter.Value" --output text --no-cli-pager)

docker compose -f docker-compose.free.yml exec -T \
    -e ADMIN_BOOTSTRAP_EMAIL="${ADMIN_EMAIL}" \
    -e ADMIN_BOOTSTRAP_PASSWORD="${ADMIN_PASS}" \
    backend python -m app.cli create-admin --force

echo "ADMIN_PROVISIONED_SUCCESSFULLY"
