#!/usr/bin/env bash
# Smoke-test public + admin API routes on the VPS.
# Usage:
#   bash deploy/smoke-api.sh
#   TOKEN='eyJ...' bash deploy/smoke-api.sh
set -euo pipefail
BASE="${API_BASE:-http://127.0.0.1:4000}"

echo "=== Public ==="
for path in /api/health /api/catalog; do
  code=$(curl -s -o /tmp/aes-smoke.json -w "%{http_code}" "$BASE$path" || echo "000")
  echo "$code  $path"
  if [[ "$code" != "200" ]]; then
    head -c 300 /tmp/aes-smoke.json; echo
  fi
done

if [[ -z "${TOKEN:-}" ]]; then
  echo ""
  echo "Set TOKEN to test admin routes, e.g. after login:"
  echo "  TOKEN=\$(curl -s $BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@aienterprisestudio.com\",\"password\":\"YOUR_PASSWORD\"}' | sed -n 's/.*\"accessToken\":\"\\([^\"]*\\)\".*/\\1/p')"
  echo "  TOKEN=\$TOKEN bash deploy/smoke-api.sh"
  exit 0
fi

echo ""
echo "=== Admin (authenticated) ==="
AUTH="Authorization: Bearer $TOKEN"
for path in \
  /api/admin/health \
  /api/admin/schema-check \
  /api/admin/dashboard \
  /api/admin/settings \
  /api/admin/products \
  /api/admin/bundles \
  /api/admin/users \
  /api/notifications
do
  code=$(curl -s -o /tmp/aes-smoke.json -w "%{http_code}" -H "$AUTH" "$BASE$path" || echo "000")
  echo "$code  $path"
  if [[ "$code" != "200" ]]; then
    head -c 400 /tmp/aes-smoke.json; echo
  fi
done
