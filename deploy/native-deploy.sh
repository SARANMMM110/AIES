#!/usr/bin/env bash
# Build + migrate + start AES on the host with PM2 + nginx (no Docker).
# Usage (from /var/www/AIES): bash deploy/native-deploy.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  if [[ -f .env.production ]]; then
    cp .env.production .env
    echo "Copied .env.production → .env"
  else
    echo "Missing .env — create it from .env.production.example (Supabase Session pooler URL)."
    exit 1
  fi
fi

# Load env for build-time NEXT_PUBLIC_* and DATABASE_URL
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is empty in .env"
  exit 1
fi

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Building..."
export NODE_ENV=production
pnpm build

echo "Running migrations..."
pnpm db:migrate

mkdir -p apps/api/data/reseller-assets

echo "Configuring nginx..."
if [[ "$(id -u)" -eq 0 ]]; then
  cp deploy/nginx/host.bootstrap.conf /etc/nginx/sites-available/aienterprisestudio
  ln -sfn /etc/nginx/sites-available/aienterprisestudio /etc/nginx/sites-enabled/aienterprisestudio
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl reload nginx
else
  echo "Not root — skip nginx install. As root, copy deploy/nginx/host.bootstrap.conf into sites-available."
fi

echo "Starting PM2 processes..."
pm2 delete aes-api aes-web 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u "${SUDO_USER:-root}" --hp "${HOME}" 2>/dev/null || true

echo ""
echo "Done."
echo "  Health:  curl -s http://127.0.0.1:4000/api/health"
echo "  Site:    curl -I http://127.0.0.1/"
echo "  Seed:    pnpm db:seed"
echo "  SSL:     certbot --nginx -d aienterprisestudio.com -d www.aienterprisestudio.com"
pm2 status
