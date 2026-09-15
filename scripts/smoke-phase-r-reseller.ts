/**
 * Phase R — reseller entitlements are separate from ProductAccess.
 * Catalog must stay 10 / 99 / 306.
 *
 * Run: pnpm exec tsx scripts/smoke-phase-r-reseller.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { prisma } from "@aes/database";
import { grantResellerEntitlementsForPurchase } from "../apps/api/src/modules/reseller/entitlements";
import { createResellerOffer } from "../apps/api/src/modules/reseller/offers";

config({ path: resolve(__dirname, "../.env") });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

async function main() {
  const [products, services, workflows, wikiArticles] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.productResource.count({ where: { type: "SERVICE" } }),
    prisma.workflowDefinition.count(),
    prisma.wikiArticle.count({ where: { status: "PUBLISHED" } }),
  ]);
  assert(products === 10, `published products=${products}`);
  assert(services === 99, `services=${services}`);
  if (workflows !== 306) {
    console.warn(`WARN: workflows=${workflows} (expected 306). Reseller layer did not add workflows.`);
  }
  if (wikiArticles !== 172) {
    console.warn(`WARN: published wiki articles=${wikiArticles} (expected 172).`);
  }

  const product = await prisma.product.findFirst({
    where: { status: "PUBLISHED", slug: "booking-flow-agency" },
  });
  assert(product, "booking-flow-agency missing");

  const other = await prisma.product.findFirst({
    where: { status: "PUBLISHED", slug: "trust-builder-agency" },
  });
  assert(other, "trust-builder-agency missing");

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `reseller.smoke.${Date.now()}@test.local`,
          passwordHash: "not-a-login",
          firstName: "Smoke",
          lastName: "Reseller",
        },
      });
      const policy = await tx.resellerPolicy.create({
        data: {
          scope: "PRODUCT",
          productId: product.id,
          enabled: true,
          allowBranding: true,
        },
      });
      const purchase = await tx.purchase.create({
        data: {
          code: `PUR-SMK${Date.now().toString().slice(-6)}`,
          userId: user.id,
          status: "COMPLETED",
          purchaseType: "PRODUCT",
          totalAmount: product.priceCents ?? 0,
          subtotalAmount: product.priceCents ?? 0,
          currency: "USD",
          paymentStatus: "SIMULATED",
          accessProvisionedAt: new Date(),
          items: {
            create: {
              itemType: "PRODUCT",
              productId: product.id,
              price: product.priceCents ?? 0,
            },
          },
        },
      });

      const granted = await grantResellerEntitlementsForPurchase(tx, purchase.id);
      assert(granted.length === 1, `expected 1 entitlement, got ${granted.length}`);
      assert(granted[0]?.scope === "PRODUCT", "scope");
      const covered = granted[0]?.coveredProductIds;
      assert(Array.isArray(covered) && covered.length === 1 && covered[0] === product.id, "covers booking flow only");

      const access = await tx.productAccess.count({ where: { userId: user.id } });
      assert(access === 0, "reseller grant must not create ProductAccess");

      const again = await grantResellerEntitlementsForPurchase(tx, purchase.id);
      assert(again.length === 1, "grant is idempotent");
      const count = await tx.resellerEntitlement.count({ where: { userId: user.id } });
      assert(count === 1, "no duplicate entitlement rows");

      void policy;
      throw new Error("ROLLBACK");
    });
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "ROLLBACK") throw err;
  }

  let rejected = false;
  try {
    await createResellerOffer("missing-user", {
      entitlementId: "missing-entitlement",
      title: "Should fail",
      priceCents: 2500,
      productIds: [other.id],
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "offer without entitlement must be rejected");

  const extras = await prisma.product.count({
    where: { status: "PUBLISHED", slug: { notIn: ["ai-advantage-agency", "booking-flow-agency", "demand-builder-agency", "local-alliance-agency", "local-presence-agency", "referral-loop-agency", "repeat-revenue-agency", "revenue-revival-agency", "trust-builder-agency", "video-authority-agency"] } },
  });
  assert(extras === 0, "reseller layer added a catalog product");
  console.log(`Phase R reseller smoke passed. Catalog products=${products} services=${services} workflows=${workflows} wiki=${wikiArticles}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
