#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

EMAIL="${CERTBOT_EMAIL:-admin@aienterprisestudio.com}"

docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d aienterprisestudio.com \
  -d www.aienterprisestudio.com \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

cp -f deploy/nginx/aienterprisestudio.ssl.conf deploy/nginx/aienterprisestudio.conf
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

echo "SSL enabled. Visit https://aienterprisestudio.com"
