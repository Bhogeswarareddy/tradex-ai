#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="${INSTANCE_ID:-i-0dcaa6d4865bbdda3}"
SG_ID="sg-03b8bab5f4d9583a0"
ROLE_NAME="tradex-ec2-role"
PROFILE_NAME="tradex-ec2-profile"
KEY_NAME="tradex-deployer"
REGION="${AWS_REGION:-ap-south-1}"

echo "WARNING: This will permanently terminate all TradeX AI AWS resources!"
read -p "Type 'DELETE' to confirm destruction: " CONFIRM
if [[ "${CONFIRM}" != "DELETE" ]]; then
    echo "Destruction aborted."
    exit 0
fi

echo "==> 1. Terminating EC2 instance ${INSTANCE_ID}..."
~/.local/bin/aws ec2 terminate-instances --instance-ids "${INSTANCE_ID}" --region "${REGION}" --no-cli-pager
echo "==> Waiting for instance termination..."
~/.local/bin/aws ec2 wait instance-terminated --instance-ids "${INSTANCE_ID}" --region "${REGION}" --no-cli-pager

echo "==> 2. Removing IAM instance profile & role..."
~/.local/bin/aws iam remove-role-from-instance-profile --instance-profile-name "${PROFILE_NAME}" --role-name "${ROLE_NAME}" --no-cli-pager || true
~/.local/bin/aws iam delete-instance-profile --instance-profile-name "${PROFILE_NAME}" --no-cli-pager || true

~/.local/bin/aws iam delete-role-policy --role-name "${ROLE_NAME}" --policy-name tradex-ssm-read --no-cli-pager || true
~/.local/bin/aws iam detach-role-policy --role-name "${ROLE_NAME}" --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly --no-cli-pager || true
~/.local/bin/aws iam detach-role-policy --role-name "${ROLE_NAME}" --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy --no-cli-pager || true
~/.local/bin/aws iam delete-role --role-name "${ROLE_NAME}" --no-cli-pager || true

echo "==> 3. Deleting Security Group ${SG_ID}..."
~/.local/bin/aws ec2 delete-security-group --group-id "${SG_ID}" --region "${REGION}" --no-cli-pager || true

echo "==> 4. Deleting Key Pair ${KEY_NAME}..."
~/.local/bin/aws ec2 delete-key-pair --key-name "${KEY_NAME}" --region "${REGION}" --no-cli-pager || true
rm -f ~/.ssh/tradex-deployer.pem

echo "==> 5. Deleting SSM Parameters..."
for p in secret_key groq_api_key admin_email admin_password postgres_password; do
    ~/.local/bin/aws ssm delete-parameter --name "/tradex/prod/${p}" --region "${REGION}" --no-cli-pager || true
done

echo "==> All TradeX AI AWS resources successfully destroyed."
