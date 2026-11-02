#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-0dcaa6d4865bbdda3}"
REGION="${AWS_REGION:-ap-south-1}"

echo "==> Stopping EC2 instance ${INSTANCE_ID} in ${REGION}..."
~/.local/bin/aws ec2 stop-instances --instance-ids "${INSTANCE_ID}" --region "${REGION}" --no-cli-pager
echo "==> Instance ${INSTANCE_ID} stop initiated. Compute billing is paused."
