#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-0dcaa6d4865bbdda3}"
REGION="${AWS_REGION:-ap-south-1}"

echo "==> Starting EC2 instance ${INSTANCE_ID} in ${REGION}..."
~/.local/bin/aws ec2 start-instances --instance-ids "${INSTANCE_ID}" --region "${REGION}" --no-cli-pager
echo "==> Waiting for instance to enter running state..."
~/.local/bin/aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}" --region "${REGION}" --no-cli-pager
NEW_IP=$(~/.local/bin/aws ec2 describe-instances --instance-ids "${INSTANCE_ID}" --region "${REGION}" --query "Reservations[0].Instances[0].PublicIpAddress" --output text --no-cli-pager)
echo "==> Instance ${INSTANCE_ID} is RUNNING at Public IP: ${NEW_IP}"
