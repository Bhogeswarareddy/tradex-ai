#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"

echo "==> Storing production secrets in AWS SSM Parameter Store as standard SecureString (free)..."

# Prompt for secrets securely if not passed in environment
if [[ -z "${ADMIN_EMAIL:-}" ]]; then
    read -p "Enter Production Admin Email: " ADMIN_EMAIL
fi

if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    read -s -p "Enter Production Admin Password: " ADMIN_PASSWORD
    echo ""
fi

if [[ -z "${SECRET_KEY:-}" ]]; then
    read -s -p "Enter App Secret Key (min 32 chars): " SECRET_KEY
    echo ""
fi

if [[ -z "${GROQ_API_KEY:-}" ]]; then
    read -s -p "Enter Groq API Key: " GROQ_API_KEY
    echo ""
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    read -s -p "Enter PostgreSQL Database Password: " POSTGRES_PASSWORD
    echo ""
fi

aws ssm put-parameter \
    --name "/tradex/prod/secret_key" \
    --value "${SECRET_KEY}" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --tags "Key=Project,Value=tradex-ai" \
    --no-cli-pager

aws ssm put-parameter \
    --name "/tradex/prod/groq_api_key" \
    --value "${GROQ_API_KEY}" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --tags "Key=Project,Value=tradex-ai" \
    --no-cli-pager

aws ssm put-parameter \
    --name "/tradex/prod/admin_email" \
    --value "${ADMIN_EMAIL}" \
    --type "String" \
    --overwrite \
    --region "${REGION}" \
    --tags "Key=Project,Value=tradex-ai" \
    --no-cli-pager

aws ssm put-parameter \
    --name "/tradex/prod/admin_password" \
    --value "${ADMIN_PASSWORD}" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --tags "Key=Project,Value=tradex-ai" \
    --no-cli-pager

aws ssm put-parameter \
    --name "/tradex/prod/postgres_password" \
    --value "${POSTGRES_PASSWORD}" \
    --type "SecureString" \
    --overwrite \
    --region "${REGION}" \
    --tags "Key=Project,Value=tradex-ai" \
    --no-cli-pager

echo "==> All parameters successfully synchronized to AWS SSM Parameter Store."
