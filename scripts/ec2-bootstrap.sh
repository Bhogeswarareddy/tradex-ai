#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Bootstrap Amazon EC2 Host for TradeX AI (Ubuntu 24.04 LTS)
# Installs Docker, AWS CLI, ufw (22, 80, 443), swap, and unattended updates
# Supports DRY_RUN=1 mode
# ==============================================================================

APP_DIR="${APP_DIR:-/opt/tradex-ai}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[DRY-RUN] Target OS: Ubuntu 24.04 LTS"
    echo "[DRY-RUN] Would update apt packages and install curl, jq, git, ufw, unattended-upgrades"
    echo "[DRY-RUN] Would configure ${SWAP_SIZE_GB}GB swapfile at /swapfile"
    echo "[DRY-RUN] Would install Docker Engine & Compose plugin, adding user ubuntu to docker group"
    echo "[DRY-RUN] Would install AWS CLI v2"
    echo "[DRY-RUN] Would configure UFW: allow 22/tcp, 80/tcp, 443/tcp, default deny incoming"
    echo "[DRY-RUN] Would create app directory: ${APP_DIR}"
    exit 0
fi

echo "==> 1. Updating base operating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git jq ca-certificates gnupg lsb-release ufw unattended-upgrades

echo "==> 2. Setting up ${SWAP_SIZE_GB}GB swap file..."
if ! sudo swapon --show | grep -q "/swapfile"; then
    sudo fallocate -l "${SWAP_SIZE_GB}G" /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> 3. Installing Docker Engine & Docker Compose plugin..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Grant non-root user docker permissions
CURRENT_USER="${SUDO_USER:-$USER}"
sudo usermod -aG docker "${CURRENT_USER}"

echo "==> 4. Installing AWS CLI v2..."
if ! command -v aws >/dev/null 2>&1; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
fi

echo "==> 5. Hardening firewall with UFW (22, 80, 443)..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
echo "y" | sudo ufw enable

echo "==> 6. Enabling unattended security upgrades..."
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> 7. Creating application directory: ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${CURRENT_USER}:${CURRENT_USER}" "${APP_DIR}"

echo "==> EC2 Bootstrap completed successfully. Please relogin to activate docker group membership."
