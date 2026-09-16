#!/usr/bin/env sh
# Print last migrate failure details (run on VPS).
set -eu
cd "$(dirname "$0")/.."
docker compose -f docker-compose.prod.yml logs --no-color migrate 2>&1 | tail -n 80
echo "----"
docker compose -f docker-compose.prod.yml run --rm --no-deps migrate \
  sh -c '/app/node_modules/.bin/prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma' || true
