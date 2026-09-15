import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";

async function main() {
  const { grantResellerEntitlementsForPurchase } = await import("../apps/api/src/modules/reseller/entitlements");
  const stamp = Date.now();
  const passwordHash = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";
  const reseller = await prisma.user.create({
    data: {
      email: `browser.reseller.${stamp}@test.local`,
      passwordHash,
      firstName: "Browser",
      lastName: "Reseller",
    },
  });
  const product = await prisma.product.findFirstOrThrow({ where: { slug: "booking-flow-agency" } });
  const previous = await prisma.resellerPolicy.findUnique({ where: { productId: product.id } });
  if (previous) await prisma.resellerPolicy.update({ where: { id: previous.id }, data: { enabled: true } });
  else {
    await prisma.resellerPolicy.create({ data: { scope: "PRODUCT", productId: product.id, enabled: true } });
  }
  const purchase = await prisma.purchase.create({
    data: {
      code: `PUR-BR${String(stamp).slice(-6)}`,
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
  const { createResellerOffer } = await import("../apps/api/src/modules/reseller/offers");
  const offer = await createResellerOffer(reseller.id, {
    entitlementId: rights[0]!.id,
    title: "ABC Growth Solutions Booking",
    description: "Automate customer booking workflows.",
    priceCents: 59900,
    productIds: [product.id],
    brandName: "ABC Growth Solutions",
    status: "PUBLISHED",
  });
  console.log(JSON.stringify({ slug: offer.slug, offerId: offer.id, resellerId: reseller.id, previousEnabled: previous?.enabled ?? null, createdPolicy: !previous }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
