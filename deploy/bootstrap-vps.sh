#!/usr/bin/env bash
set -euo pipefail

# Usage (on VPS after project is in /opt/aes):
#   bash deploy/bootstrap-vps.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production — copy from .env.production.example and edit secrets."
  exit 1
fi

# Compose interpolates ${VAR} from `.env` (not `.env.production`).
cp -f .env.production .env

mkdir -p deploy/certbot/www deploy/certbot/conf
cp -f deploy/nginx/aienterprisestudio.bootstrap.conf deploy/nginx/aienterprisestudio.conf

echo "Building and starting stack..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Waiting for API health..."
for i in $(seq 1 40); do
  if docker compose -f docker-compose.prod.yml exec -T api node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "API is healthy."
    break
  fi
  sleep 3
  if [[ "$i" -eq 40 ]]; then
    echo "API did not become healthy in time."
    docker compose -f docker-compose.prod.yml logs --tail=80 api
    exit 1
  fi
done

echo "Stack is up (HTTP). Next: point DNS, then run deploy/issue-ssl.sh"
docker compose -f docker-compose.prod.yml ps
