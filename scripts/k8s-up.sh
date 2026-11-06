#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TradeX AI — Bootstrap Local Kubernetes (kind) Cluster
# Sets up kind cluster, ingress controller, metrics-server, secrets, and workloads.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLUSTER_NAME="tradex-cluster"

echo "======================================================================"
echo " Starting TradeX AI Local Kubernetes Cluster (kind)"
echo "======================================================================"

# 1. Create kind cluster if it does not already exist
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  if kubectl cluster-info --context "kind-${CLUSTER_NAME}" >/dev/null 2>&1; then
    echo "==> Cluster '${CLUSTER_NAME}' is healthy and running. Reusing it."
  else
    echo "==> Cluster '${CLUSTER_NAME}' container was stopped or unresponsive; recreating cleanly..."
    kind delete cluster --name "${CLUSTER_NAME}" 2>/dev/null || true
    kind create cluster --name "${CLUSTER_NAME}" --config "${PROJECT_ROOT}/k8s/kind-config.yaml"
  fi
else
  echo "==> Creating kind cluster '${CLUSTER_NAME}' with ports 80/443 mapped..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${PROJECT_ROOT}/k8s/kind-config.yaml"
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}"

# Sync kubeconfig to user devcontainers if running in devcontainer/WSL
if [[ -f "/root/.kube/config" && -d "/home/devcontainers" ]]; then
  mkdir -p /home/devcontainers/.kube
  cp /root/.kube/config /home/devcontainers/.kube/config 2>/dev/null || true
  chown -R devcontainers:devcontainers /home/devcontainers/.kube 2>/dev/null || true
fi

# 2. Deploy NGINX Ingress Controller for kind
echo "==> Installing NGINX Ingress Controller for kind..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "==> Awaiting Ingress Controller readiness (up to 90s)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s || echo "Warning: Ingress controller wait reached timeout; continuing..."

# 3. Deploy Metrics Server with insecure TLS flag for local kind
echo "==> Deploying Metrics Server for HPA and 'kubectl top'..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' || true

# 4. Build or verify local Docker images
echo "==> Verifying local Docker images..."
cd "${PROJECT_ROOT}"
if ! docker image inspect tradex-ai-backend:latest >/dev/null 2>&1; then
  echo "==> Building backend image..."
  docker build -t tradex-ai-backend:latest ./backend
else
  echo "==> Using existing tradex-ai-backend:latest image."
fi
if ! docker image inspect tradex-ai-frontend:latest >/dev/null 2>&1; then
  echo "==> Building frontend image..."
  docker build -t tradex-ai-frontend:latest ./frontend
else
  echo "==> Using existing tradex-ai-frontend:latest image."
fi

echo "==> Loading Docker images into kind cluster '${CLUSTER_NAME}'..."
kind load docker-image tradex-ai-backend:latest --name "${CLUSTER_NAME}"
kind load docker-image tradex-ai-frontend:latest --name "${CLUSTER_NAME}"
kind load docker-image pgvector/pgvector:pg16 --name "${CLUSTER_NAME}" || true

# 5. Create Secrets and TLS Certificate
echo "==> Creating Kubernetes Secrets and Ingress TLS certificate..."
bash "${PROJECT_ROOT}/scripts/k8s-create-secrets.sh"
bash "${PROJECT_ROOT}/scripts/k8s-gen-cert.sh"

# 6. Apply Kustomize Manifests
echo "==> Applying Kubernetes manifests via Kustomize (overlays/local)..."
kubectl apply -k "${PROJECT_ROOT}/k8s/overlays/local"

# 7. Await Workload Rollouts
echo "==> Waiting for Postgres StatefulSet..."
kubectl rollout status statefulset/postgres -n tradex --timeout=120s

echo "==> Ensuring PostgreSQL extensions (vector, pg_trgm) exist..."
kubectl exec -i -n tradex statefulset/postgres -- psql -U tradex_user -d tradex -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;" || true

echo "==> Running Database Migrations and Seed Job..."
kubectl delete job tradex-migration -n tradex 2>/dev/null || true
kubectl apply -f "${PROJECT_ROOT}/k8s/base/migration-job.yaml"
kubectl wait --for=condition=complete job/tradex-migration -n tradex --timeout=180s || true

echo "==> Waiting for Backend Deployment..."
kubectl rollout status deployment/backend -n tradex --timeout=120s

echo "==> Waiting for Frontend Deployment..."
kubectl rollout status deployment/frontend -n tradex --timeout=120s

echo ""
echo "======================================================================"
echo " TradeX AI Kubernetes Cluster is READY!"
echo " Ingress URL: https://localhost/"
echo " Health API : https://localhost/api/health"
echo "======================================================================"
kubectl get pods,svc,ingress,hpa -n tradex
