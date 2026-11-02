#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-0dcaa6d4865bbdda3}"
REGION="${AWS_REGION:-ap-south-1}"

echo "==> Creating CloudWatch Alarms for instance ${INSTANCE_ID}..."

# Alarm 1: CPU > 85%
~/.local/bin/aws cloudwatch put-metric-alarm \
    --alarm-name "tradex-cpu-utilization-high" \
    --alarm-description "Triggers when EC2 CPU exceeds 85% for 5 minutes" \
    --metric-name "CPUUtilization" \
    --namespace "AWS/EC2" \
    --statistic "Average" \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 85 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=InstanceId,Value="${INSTANCE_ID}" \
    --tags Key=Project,Value=tradex-ai \
    --region "${REGION}" \
    --no-cli-pager

# Alarm 2: Status Check Failed
~/.local/bin/aws cloudwatch put-metric-alarm \
    --alarm-name "tradex-status-check-failed" \
    --alarm-description "Triggers if EC2 system or instance status check fails" \
    --metric-name "StatusCheckFailed" \
    --namespace "AWS/EC2" \
    --statistic "Maximum" \
    --period 60 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator "GreaterThanOrEqualToThreshold" \
    --dimensions Name=InstanceId,Value="${INSTANCE_ID}" \
    --tags Key=Project,Value=tradex-ai \
    --region "${REGION}" \
    --no-cli-pager

# Alarm 3: Disk > 85% (from CWAgent or root EBS)
~/.local/bin/aws cloudwatch put-metric-alarm \
    --alarm-name "tradex-disk-space-high" \
    --alarm-description "Triggers when disk usage exceeds 85%" \
    --metric-name "disk_used_percent" \
    --namespace "CWAgent" \
    --statistic "Average" \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 85 \
    --comparison-operator "GreaterThanThreshold" \
    --dimensions Name=InstanceId,Value="${INSTANCE_ID}" Name=path,Value="/" \
    --tags Key=Project,Value=tradex-ai \
    --region "${REGION}" \
    --no-cli-pager

echo "CLOUDWATCH_ALARMS_CONFIGURED_SUCCESSFULLY"
