#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Docker Container Health and Statistics Report
# Outputs resource consumption (CPU, Memory, I/O) and recent logs for all TradeX services
# Supports DRY_RUN=1 mode
# ==============================================================================

SERVICES=("nginx_proxy" "fastapi_app" "react_app" "pg_db")

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Would run: docker stats --no-stream ${SERVICES[*]}"
    for svc in "${SERVICES[@]}"; do
        echo "[DRY-RUN] Would run: docker logs --tail 50 ${svc}"
    done
    exit 0
fi

echo "================================================================================"
echo " TRADE-X PLATFORM: SYSTEM RESOURCE USAGE STATS"
echo " Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "================================================================================"

# Check if containers are running
RUNNING_CONTAINERS=()
for svc in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
        RUNNING_CONTAINERS+=("${svc}")
    fi
done

if [ ${#RUNNING_CONTAINERS[@]} -eq 0 ]; then
    echo "Warning: None of the target containers (${SERVICES[*]}) are currently running."
    echo "Current active containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
fi

docker stats --no-stream "${RUNNING_CONTAINERS[@]}"

echo ""
echo "================================================================================"
echo " SERVICE LOG TAILS (LAST 50 LINES PER CONTAINER)"
echo "================================================================================"

for svc in "${RUNNING_CONTAINERS[@]}"; do
    echo ""
    echo "--------------------------------------------------------------------------------"
    echo " Logs for container: ${svc}"
    echo "--------------------------------------------------------------------------------"
    docker logs --tail 50 "${svc}" 2>&1 || echo "Could not retrieve logs for ${svc}"
done

echo ""
echo "================================================================================"
echo " Report Complete"
echo "================================================================================"
