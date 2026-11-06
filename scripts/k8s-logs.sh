#!/usr/bin/env bash
set -euo pipefail

COMPONENT="${1:-backend}"
LINES="${2:-50}"

case "$COMPONENT" in
  backend)
    echo "==> Logs for Deployment: backend (tail: ${LINES})"
    kubectl logs deployment/backend -n tradex --tail="${LINES}" -f
    ;;
  frontend)
    echo "==> Logs for Deployment: frontend (tail: ${LINES})"
    kubectl logs deployment/frontend -n tradex --tail="${LINES}" -f
    ;;
  postgres|db)
    echo "==> Logs for StatefulSet: postgres (tail: ${LINES})"
    kubectl logs statefulset/postgres -n tradex --tail="${LINES}" -f
    ;;
  migration)
    echo "==> Logs for Job: tradex-migration"
    kubectl logs job/tradex-migration -n tradex
    ;;
  ingress)
    echo "==> Logs for Ingress Controller"
    kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail="${LINES}" -f
    ;;
  *)
    echo "Usage: $0 [backend|frontend|postgres|migration|ingress] [lines]"
    exit 1
    ;;
esac
