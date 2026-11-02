#!/usr/bin/env bash
set -euo pipefail

REGION="ap-south-1"

echo "==> Storing production secrets in AWS SSM Parameter Store as standard SecureString (free)..."

~/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/secret_key" \
    --value "development-secret-key-tradex-32bytes-secure" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

~/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/groq_api_key" \
    --value "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" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

~/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/admin_email" \
    --value "katakambhogeswarareddy138@gmail.com" \
    --type "String" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

~/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/admin_password" \
    --value 'Bhogi$1385AWS' \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

~/.local/bin/aws ssm put-parameter \
    --name "/tradex/prod/postgres_password" \
    --value "tradex_prod_secure_pass_992" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --no-cli-pager

echo "==> Tagging SSM parameters Project=tradex-ai..."
for p in secret_key groq_api_key admin_email admin_password postgres_password; do
    ~/.local/bin/aws ssm add-tags-to-resource \
        --resource-type "Parameter" \
        --resource-id "/tradex/prod/${p}" \
        --tags Key=Project,Value=tradex-ai \
        --region "${REGION}" \
        --no-cli-pager || true
done

echo "SSM_PARAMETERS_STORED_SUCCESSFULLY"
