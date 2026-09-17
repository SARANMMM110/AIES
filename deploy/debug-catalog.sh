#!/usr/bin/env bash
# Diagnose /api/catalog failures on the VPS.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== .env DATABASE host ==="
grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | sed -E 's#(://[^:]+:)[^@]+#\1***#' || true

echo ""
echo "=== Prisma product/bundle query ==="
cd packages/database
node ./run-with-env.cjs node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const n = await p.product.count();
    const pub = await p.product.count({ where: { status: "PUBLISHED" } });
    console.log("products total=", n, "published=", pub);
    const one = await p.product.findMany({
      where: { status: "PUBLISHED" },
      take: 1,
      include: {
        resources: { where: { type: "SERVICE", isPublished: true }, take: 2 },
        _count: { select: { workflows: true } },
      },
    });
    console.log("sample ok", one[0]?.slug || "(none)", "services", one[0]?.resources?.length);
    const bundles = await p.bundle.findMany({
      where: { status: "ACTIVE" },
      include: { items: { include: { product: true } } },
      take: 3,
    });
    console.log("active bundles=", bundles.length);
  } catch (e) {
    console.error("PRISMA_ERROR:", e.message);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
NODE
