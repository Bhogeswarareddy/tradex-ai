#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Authenticate Docker client against Amazon ECR Registry
# Supports DRY_RUN=1 mode
# ==============================================================================

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-123456789012}"
ECR_REGISTRY="${ECR_REGISTRY:-${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would authenticate with Amazon ECR:"
    echo "[DRY-RUN] Region: ${AWS_REGION}, Registry: ${ECR_REGISTRY}"
    echo "[DRY-RUN] Command: aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
    exit 0
fi

echo "==> Authenticating Docker client to ECR: ${ECR_REGISTRY} (Region: ${AWS_REGION})..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
echo "==> ECR authentication successful."
