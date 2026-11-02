#!/usr/bin/env bash
set -euo pipefail

~/.local/bin/aws ec2 run-instances \
    --image-id ami-0fc5120b2d80d4749 \
    --instance-type t3.micro \
    --key-name tradex-deployer \
    --security-group-ids sg-03b8bab5f4d9583a0 \
    --iam-instance-profile Name=tradex-ec2-profile \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --user-data file://aws/ec2-userdata.sh \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Project,Value=tradex-ai},{Key=Name,Value=tradex-ai-server}]' 'ResourceType=volume,Tags=[{Key=Project,Value=tradex-ai},{Key=Name,Value=tradex-ai-volume}]' \
    --region ap-south-1 \
    --no-cli-pager
