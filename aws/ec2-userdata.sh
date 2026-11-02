#!/bin/bash
set -euxo pipefail

# 1. 2GB Swap file
if ! swapon --show | grep -q "/swapfile"; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. System updates & tools
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git jq ca-certificates gnupg lsb-release ufw unattended-upgrades unzip

# 3. Docker Engine & Compose
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
chmod a+r /etc/apt/keyrings/docker.gpg

VERSION_CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# 4. AWS CLI v2
if ! command -v aws >/dev/null 2>&1; then
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# 5. CloudWatch Agent
if ! command -v amazon-cloudwatch-agent-ctl >/dev/null 2>&1; then
    curl -fsSL "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb" -o /tmp/amazon-cloudwatch-agent.deb
    dpkg -i -E /tmp/amazon-cloudwatch-agent.deb || true
    rm -f /tmp/amazon-cloudwatch-agent.deb
fi

# 6. UFW Firewall (22, 80, 443)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# 7. Unattended upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# 8. App Directory & Permissions
mkdir -p /opt/tradex-ai
chown -R ubuntu:ubuntu /opt/tradex-ai

# 9. DuckDNS updater cron & systemd service
cat << 'EOF' > /usr/local/bin/duckdns-update.sh
#!/bin/bash
TOKEN=$(aws ssm get-parameter --name "/tradex/prod/duckdns_token" --with-decryption --query "Parameter.Value" --output text --region ap-south-1 2>/dev/null || echo "")
DOMAIN=$(aws ssm get-parameter --name "/tradex/prod/duckdns_domain" --query "Parameter.Value" --output text --region ap-south-1 2>/dev/null || echo "")
if [ -n "$TOKEN" ] && [ -n "$DOMAIN" ]; then
    RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip=")
    logger -t duckdns "DuckDNS update response: ${RESPONSE}"
fi
EOF
chmod +x /usr/local/bin/duckdns-update.sh

# Run DuckDNS update every 10 minutes
echo "*/10 * * * * root /usr/local/bin/duckdns-update.sh >/dev/null 2>&1" > /etc/cron.d/duckdns-update

echo "USER_DATA_COMPLETED_SUCCESSFULLY" > /var/log/tradex-init.log
