/**
 * Phase R4 — automated reseller checkout does not grant access before payment,
 * and never grants reseller rights to the buyer.
 *
 * Run: pnpm --filter @aes/api exec tsx ../../scripts/smoke-reseller-checkout.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

async function main() {
  const { applyVerifiedResellerPayment, startResellerCheckout } = await import(
    "../apps/api/src/modules/reseller/checkout"
  );
  const { createResellerOffer } = await import("../apps/api/src/modules/reseller/offers");
  const { grantResellerEntitlementsForPurchase } = await import(
    "../apps/api/src/modules/reseller/entitlements"
  );
  const product = await prisma.product.findFirst({ where: { slug: "booking-flow-agency", status: "PUBLISHED" } });
  assert(product, "booking-flow-agency missing");
  const stamp = Date.now();
  const reseller = await prisma.user.create({
    data: {
      email: `r4.reseller.${stamp}@test.local`,
      passwordHash: "not-a-login",
      firstName: "R4",
      lastName: "Reseller",
    },
  });
  const buyer = await prisma.user.create({
    data: {
      email: `r4.buyer.${stamp}@test.local`,
      passwordHash: "not-a-login",
      firstName: "R4",
      lastName: "Buyer",
    },
  });

  const previousPolicy = await prisma.resellerPolicy.findUnique({ where: { productId: product.id } });
  let createdPolicyId: string | null = null;
  try {
    if (previousPolicy) {
      await prisma.resellerPolicy.update({ where: { id: previousPolicy.id }, data: { enabled: true } });
    } else {
      const created = await prisma.resellerPolicy.create({
        data: { scope: "PRODUCT", productId: product.id, enabled: true },
      });
      createdPolicyId = created.id;
    }
    const purchase = await prisma.purchase.create({
      data: {
        code: `PUR-R4${String(stamp).slice(-6)}`,
        userId: reseller.id,
        status: "COMPLETED",
        purchaseType: "PRODUCT",
        totalAmount: 1000,
        subtotalAmount: 1000,
        currency: "USD",
        paymentStatus: "SIMULATED",
        items: { create: { itemType: "PRODUCT", productId: product.id, price: 1000 } },
      },
    });
    const rights = await grantResellerEntitlementsForPurchase(prisma, purchase.id);
    assert(rights[0]?.status === "ACTIVE", "reseller entitlement");

    const offer = await createResellerOffer(reseller.id, {
      entitlementId: rights[0]!.id,
      title: "ABC Booking Automation",
      priceCents: 59900,
      productIds: [product.id],
      status: "PUBLISHED",
    });
    assert(offer.status === "PUBLISHED", "offer published");

    const started = await startResellerCheckout({ slug: offer.slug, buyerUserId: buyer.id });
    assert(started.mode === "completed", "simulated payment verifies on the server");
    const sale = await prisma.resellerSale.findUnique({ where: { code: started.saleCode } });
    assert(sale?.status === "PAID", "sale paid");
    assert(sale?.amountCents === 59900, "server price used");
    assert(sale?.accessProvisionedAt, "access provisioned after payment");

    const accessCount = await prisma.productAccess.count({
      where: { userId: buyer.id, productId: product.id, status: "ACTIVE" },
    });
    assert(accessCount === 1, "one product access row");
    const buyerRights = await prisma.resellerEntitlement.count({ where: { userId: buyer.id } });
    assert(buyerRights === 0, "buyer has no reseller rights");

    const replay = await applyVerifiedResellerPayment({
      resellerSaleId: sale!.id,
      provider: "simulated",
      eventId: `sim_complete_${sale!.id}`,
      eventType: "simulated.completed",
      amountCents: 59900,
      currency: "USD",
      status: "paid",
    });
    assert(replay.duplicate, "duplicate payment is ignored");
    const accessAfter = await prisma.productAccess.count({
      where: { userId: buyer.id, productId: product.id, status: "ACTIVE" },
    });
    assert(accessAfter === 1, "duplicate webhook did not duplicate access");

    let mismatched = false;
    try {
      await applyVerifiedResellerPayment({
        resellerSaleId: sale!.id,
        provider: "simulated",
        eventId: `mismatch_${sale!.id}`,
        eventType: "simulated.mismatch",
        amountCents: 1,
        currency: "USD",
        status: "paid",
      });
    } catch {
      mismatched = true;
    }
    assert(mismatched, "amount mismatch rejected");

    console.log("Phase R4 reseller checkout smoke passed.");
  } finally {
    await prisma.resellerCustomerAccess.deleteMany({ where: { userId: buyer.id } });
    await prisma.productAccess.deleteMany({ where: { userId: buyer.id } });
    await prisma.paymentEvent.deleteMany({ where: { resellerSale: { resellerUserId: reseller.id } } });
    await prisma.resellerSale.deleteMany({ where: { resellerUserId: reseller.id } });
    await prisma.resellerOffer.deleteMany({ where: { resellerUserId: reseller.id } });
    await prisma.resellerCustomer.deleteMany({ where: { resellerUserId: reseller.id } });
    await prisma.resellerEntitlement.deleteMany({ where: { userId: reseller.id } });
    if (createdPolicyId) await prisma.resellerPolicy.delete({ where: { id: createdPolicyId } });
    else if (previousPolicy) {
      await prisma.resellerPolicy.update({
        where: { id: previousPolicy.id },
        data: { enabled: previousPolicy.enabled },
      });
    }
    await prisma.purchase.deleteMany({ where: { userId: reseller.id } });
    await prisma.user.deleteMany({ where: { id: { in: [reseller.id, buyer.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
