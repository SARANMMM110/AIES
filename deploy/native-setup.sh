#!/usr/bin/env bash
# One-time native VPS setup (no Docker).
# Usage: bash deploy/native-setup.sh
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx ufw

# Node 20
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

corepack enable
corepack prepare pnpm@10.22.0 --activate

npm install -g pm2

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /var/www/certbot

# Free ports if Docker nginx was bound to 80/443
if command -v docker >/dev/null 2>&1; then
  echo "Stopping Docker AES stack (if present)..."
  cd /var/www/AIES 2>/dev/null && docker compose -f docker-compose.prod.yml down 2>/dev/null || true
  docker rm -f aes-nginx aes-api aes-web aes-certbot aes-postgres aies-migrate-1 2>/dev/null || true
fi

echo "Native prerequisites installed. Next: configure .env and run bash deploy/native-deploy.sh"
node -v
pnpm -v
pm2 -v
nginx -v
