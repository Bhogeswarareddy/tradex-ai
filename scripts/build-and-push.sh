#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build & Push TradeX AI Microservices to Amazon ECR
# Tags with git SHA and latest
# Supports DRY_RUN=1 mode
# ==============================================================================

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-123456789012}"
ECR_REGISTRY="${ECR_REGISTRY:-${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com}"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "prod-$(date +%s)")"
SERVICES=("backend" "frontend" "nginx")

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Region: ${AWS_REGION}, Registry: ${ECR_REGISTRY}, Git SHA: ${GIT_SHA}"
    for svc in "${SERVICES[@]}"; do
        echo "[DRY-RUN] Would ensure ECR repo exists: tradex-ai/${svc}"
        echo "[DRY-RUN] Would build docker image: ./${svc} -> ${ECR_REGISTRY}/tradex-ai/${svc}:${GIT_SHA}"
        echo "[DRY-RUN] Would tag: ${ECR_REGISTRY}/tradex-ai/${svc}:latest"
        echo "[DRY-RUN] Would push ${ECR_REGISTRY}/tradex-ai/${svc}:${GIT_SHA} and :latest"
    done
    exit 0
fi

# Ensure ECR repositories exist
for svc in "${SERVICES[@]}"; do
    repo_name="tradex-ai/${svc}"
    echo "==> Verifying ECR repository: ${repo_name}..."
    aws ecr describe-repositories --repository-names "${repo_name}" --region "${AWS_REGION}" >/dev/null 2>&1 || \
        aws ecr create-repository --repository-name "${repo_name}" --region "${AWS_REGION}" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
done

# Build and Push each service
for svc in "${SERVICES[@]}"; do
    target_repo="${ECR_REGISTRY}/tradex-ai/${svc}"
    echo "==> Building ${svc} image..."
    docker build -t "${target_repo}:${GIT_SHA}" -t "${target_repo}:latest" "./${svc}"

    echo "==> Pushing ${svc} images to ECR..."
    docker push "${target_repo}:${GIT_SHA}"
    docker push "${target_repo}:latest"
done

echo "==> Build and push to ECR completed successfully. Deployed Tag: ${GIT_SHA}"
