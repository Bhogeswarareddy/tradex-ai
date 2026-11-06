#!/usr/bin/env bash
set -euo pipefail

echo "======================================================================"
echo " TRADEX AI — KUBERNETES CLUSTER STATUS"
echo "======================================================================"

echo -e "\n--- NODES ---"
kubectl get nodes -o wide

echo -e "\n--- WORKLOADS & RESOURCES (Namespace: tradex) ---"
kubectl get pods,svc,ingress,pvc,hpa -n tradex -o wide

echo -e "\n--- METRICS / RESOURCE USAGE (kubectl top) ---"
kubectl top nodes 2>/dev/null || echo "Node metrics initializing..."
kubectl top pods -n tradex 2>/dev/null || echo "Pod metrics initializing..."
