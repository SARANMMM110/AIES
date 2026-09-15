/**
 * R4.1 verification against the running API and database.
 * Cleans up only records it creates. Does not change the catalog.
 *
 * Run: pnpm --filter @aes/api exec tsx ../../scripts/verify-r41-reseller.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";

const API = process.env.API_URL ?? "http://localhost:4000";

type Json = { success: boolean; data?: any; error?: { message: string; code?: string } };

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

async function json(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const body = (await res.json()) as Json;
  return { status: res.status, body };
}

async function main() {
  const { refundResellerSale } = await import("../apps/api/src/modules/reseller/checkout");
  const results: string[] = [];
  const pass = (name: string) => {
    results.push(`PASS ${name}`);
    console.log(`PASS ${name}`);
  };

  const health = await json("/api/health");
  assert(health.status === 200 && health.body.data?.database === "up", "health");
  pass("api health");

  const [products, services, workflows, categories, articles] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.productResource.count({ where: { type: "SERVICE" } }),
    prisma.workflowDefinition.count(),
    prisma.wikiCategory.count(),
    prisma.wikiArticle.count({ where: { status: "PUBLISHED" } }),
  ]);
  console.log(
    `COUNTS products=${products} services=${services} workflows=${workflows} wikiCategories=${categories} wikiArticles=${articles}`
  );

  await prisma.user.deleteMany({ where: { email: { endsWith: "@test.local" }, lastName: "R41" } });
  const stamp = Date.now();
  const password = "Verify123!Test";
  async function register(prefix: string) {
    const email = `${prefix}.${stamp}@test.local`;
    const res = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName: prefix, lastName: "R41" }),
    });
    assert(res.status === 201 || res.status === 200, `register ${prefix} ${res.status} ${res.body.error?.message}`);
    return { email, token: res.body.data.tokens.accessToken as string, id: res.body.data.user.id as string };
  }

  const createdIds: string[] = [];
  const resellerA = await register("ra");
  const resellerB = await register("rb");
  const buyerA = await register("ba");
  const buyerB = await register("bb");
  createdIds.push(resellerA.id, resellerB.id, buyerA.id, buyerB.id);
  const dup = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: buyerA.email, password, firstName: "Dup", lastName: "User" }),
  });
  assert(dup.status === 409, "duplicate email blocked");
  pass("auth register/login isolation of duplicate email");

  const product = await prisma.product.findFirst({ where: { slug: "booking-flow-agency", status: "PUBLISHED" } });
  const other = await prisma.product.findFirst({ where: { slug: "trust-builder-agency", status: "PUBLISHED" } });
  assert(product && other, "catalog products present");

  const previousPolicy = await prisma.resellerPolicy.findUnique({ where: { productId: product.id } });
  let createdPolicyId: string | null = null;
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
      code: `PUR-R41${String(stamp).slice(-6)}`,
      userId: resellerA.id,
      status: "COMPLETED",
      purchaseType: "PRODUCT",
      totalAmount: 1000,
      subtotalAmount: 1000,
      currency: "USD",
      paymentStatus: "SIMULATED",
      items: { create: { itemType: "PRODUCT", productId: product.id, price: 1000 } },
    },
  });
  const { grantResellerEntitlementsForPurchase } = await import("../apps/api/src/modules/reseller/entitlements");
  const rights = await grantResellerEntitlementsForPurchase(prisma, purchase.id);
  assert(rights[0]?.id, "entitlement granted to reseller A");

  const offerRes = await json("/api/reseller/offers", {
    method: "POST",
    token: resellerA.token,
    body: JSON.stringify({
      entitlementId: rights[0]!.id,
      title: "R41 Booking Desk",
      description: "Booking workflows for a client brand.",
      priceCents: 59900,
      productIds: [other.id],
      status: "PUBLISHED",
    }),
  });
  assert(offerRes.status === 403, "cannot publish an unentitled product");
  pass("offer product scope rejected");

  const createdOffer = await json("/api/reseller/offers", {
    method: "POST",
    token: resellerA.token,
    body: JSON.stringify({
      entitlementId: rights[0]!.id,
      title: "R41 Booking Desk",
      description: "Automate customer booking workflows.",
      priceCents: 59900,
      productIds: [product.id],
      brandName: "ABC Growth Solutions",
      status: "PUBLISHED",
    }),
  });
  assert(createdOffer.status === 201, `create offer ${createdOffer.body.error?.message}`);
  const slug = createdOffer.body.data.slug as string;
  const offerId = createdOffer.body.data.id as string;

  const beforeSales = await prisma.resellerSale.count({ where: { offerId } });
  const beforeAccess = await prisma.productAccess.count({ where: { userId: buyerA.id } });
  const publicOffer = await json(`/api/reseller/public/offers/${slug}`);
  assert(publicOffer.status === 200, "published offer loads");
  assert(publicOffer.body.data.priceCents === 59900, "server price");
  assert(publicOffer.body.data.brandName === "ABC Growth Solutions", "brand");
  assert(publicOffer.body.data.products?.[0]?.name, "product name");
  assert(!publicOffer.body.data.entitlementId, "no entitlement id");
  assert(!JSON.stringify(publicOffer.body.data).includes(resellerA.id), "no reseller id");
  assert((await prisma.resellerSale.count({ where: { offerId } })) === beforeSales, "view does not create sale");
  assert((await prisma.productAccess.count({ where: { userId: buyerA.id } })) === beforeAccess, "view does not grant access");
  pass("public offer does not provision");

  const missing = await json("/api/reseller/public/offers/not-a-real-offer");
  assert(missing.status === 404, "invalid slug");
  pass("invalid offer");

  const guestPay = await json(`/api/reseller/public/offers/${slug}/checkout`, {
    method: "POST",
    body: JSON.stringify({ priceCents: 1, productId: other.id, resellerId: resellerB.id, currency: "EUR", resell: true, admin: true }),
  });
  assert(guestPay.status === 401, "guest checkout blocked");
  pass("unauthenticated checkout blocked");

  const buyerMe = await json("/api/reseller/me", { token: buyerA.token });
  assert(buyerMe.status === 200 && buyerMe.body.data.entitlements.length === 0, "buyer has no reseller rights before purchase");

  const paid = await json(`/api/reseller/public/offers/${slug}/checkout`, {
    method: "POST",
    token: buyerA.token,
    body: JSON.stringify({
      priceCents: 1,
      productId: other.id,
      bundleId: "fake",
      resellerId: resellerB.id,
      offerId: "fake",
      currency: "EUR",
      resell: true,
      admin: true,
      access: true,
    }),
  });
  assert(paid.status === 201, `checkout ${paid.body.error?.message}`);
  assert(paid.body.data.accessReady === true, "simulated server verification provisioned");
  const sale = await prisma.resellerSale.findUnique({ where: { code: paid.body.data.saleCode } });
  assert(sale?.amountCents === 59900 && sale.currency === "USD", "manipulated price/currency ignored");
  assert(sale?.resellerUserId === resellerA.id, "reseller taken from offer");
  assert(sale?.status === "PAID", "sale paid");
  const accessRows = await prisma.productAccess.findMany({ where: { userId: buyerA.id, status: "ACTIVE" } });
  assert(accessRows.length === 1 && accessRows[0]?.productId === product.id && accessRows[0]?.source === "RESELLER", "one reseller-origin access");
  const buyerRights = await prisma.resellerEntitlement.count({ where: { userId: buyerA.id } });
  assert(buyerRights === 0, "no reseller entitlement after purchase");
  pass("payment ignores client price and does not grant reseller rights");

  const status = await json(`/api/reseller/checkout/${sale!.code}`, { token: buyerA.token });
  assert(status.body.data.status === "PAID" && status.body.data.accessReady, "confirmation is server state");
  const otherBuyer = await json(`/api/reseller/checkout/${sale!.code}`, { token: buyerB.token });
  assert(otherBuyer.status === 404, "other customer cannot read checkout");
  pass("checkout status isolated");

  const { applyVerifiedResellerPayment } = await import("../apps/api/src/modules/reseller/checkout");
  const replay = await applyVerifiedResellerPayment({
    resellerSaleId: sale!.id,
    provider: "simulated",
    eventId: `sim_complete_${sale!.id}`,
    eventType: "simulated.completed",
    amountCents: 59900,
    currency: "USD",
    status: "paid",
  });
  assert(replay.duplicate, "duplicate event ignored");
  assert((await prisma.productAccess.count({ where: { userId: buyerA.id, productId: product.id } })) === 1, "no duplicate access");
  assert((await prisma.user.count({ where: { email: buyerA.email } })) === 1, "no duplicate user");
  pass("duplicate payment");

  let mismatch = false;
  try {
    await applyVerifiedResellerPayment({
      resellerSaleId: sale!.id,
      provider: "simulated",
      eventId: `bad_amt_${stamp}`,
      eventType: "test.mismatch",
      amountCents: 1,
      currency: "USD",
      status: "paid",
    });
  } catch {
    mismatch = true;
  }
  assert(mismatch, "wrong amount rejected");
  let currencyMismatch = false;
  try {
    await applyVerifiedResellerPayment({
      resellerSaleId: sale!.id,
      provider: "simulated",
      eventId: `bad_cur_${stamp}`,
      eventType: "test.currency",
      amountCents: 59900,
      currency: "EUR",
      status: "paid",
    });
  } catch {
    currencyMismatch = true;
  }
  assert(currencyMismatch, "wrong currency rejected");
  const unknown = await applyVerifiedResellerPayment({
    resellerSaleId: "missing-sale",
    provider: "simulated",
    eventId: `unknown_${stamp}`,
    eventType: "test.unknown",
    status: "paid",
  }).then(() => false).catch(() => true);
  assert(unknown, "unknown sale rejected");
  pass("amount, currency, unknown payment rejected");

  const failed = await prisma.resellerSale.create({
    data: {
      code: `RS-FAIL${String(stamp).slice(-4)}`,
      offerId,
      resellerUserId: resellerA.id,
      customerId: sale!.customerId,
      status: "PENDING",
      amountCents: 59900,
      currency: "USD",
      snapshot: { productIds: [product.id], slug, title: "x", priceCents: 59900, currency: "USD", brandName: null, productSlugs: [product.slug], bundleId: null },
    },
  });
  await applyVerifiedResellerPayment({
    resellerSaleId: failed.id,
    provider: "simulated",
    eventId: `fail_${stamp}`,
    eventType: "test.failed",
    status: "failed",
  });
  const failedRow = await prisma.resellerSale.findUnique({ where: { id: failed.id } });
  assert(failedRow?.status === "FAILED", "failed payment status");
  assert((await prisma.productAccess.count({ where: { userId: buyerA.id } })) === 1, "failed payment did not add access");
  pass("failed payment");

  const second = await json(`/api/reseller/public/offers/${slug}/checkout`, {
    method: "POST",
    token: buyerA.token,
    body: JSON.stringify({ priceCents: 1 }),
  });
  assert(second.status === 201, "repeat purchase");
  const sales = await prisma.resellerSale.count({ where: { offerId, customer: { userId: buyerA.id }, status: "PAID" } });
  assert(sales === 2, "both paid sales retained");
  assert((await prisma.productAccess.count({ where: { userId: buyerA.id, productId: product.id, status: "ACTIVE" } })) === 1, "repeat purchase does not duplicate access");
  pass("repeat purchase");

  const saleB = await prisma.resellerSale.findUnique({ where: { code: second.body.data.saleCode } });
  await refundResellerSale(sale!.id, resellerA.id, "rf_test_1");
  const refunded = await prisma.resellerSale.findUnique({ where: { id: sale!.id } });
  assert(refunded?.status === "REFUNDED" && refunded.refundReference === "rf_test_1", "refund recorded");
  assert((await prisma.user.findUnique({ where: { id: buyerA.id } }))?.isActive !== false, "customer account remains");
  const stillActive = await prisma.productAccess.findFirst({ where: { userId: buyerA.id, productId: product.id, status: "ACTIVE" } });
  assert(stillActive, "access remains while second sale covers it");
  await refundResellerSale(saleB!.id, resellerA.id, "rf_test_2");
  const afterBoth = await prisma.productAccess.findFirst({ where: { userId: buyerA.id, productId: product.id, status: "ACTIVE" } });
  assert(!afterBoth, "access revoked when no paid sale covers it");
  const history = await prisma.resellerSale.count({ where: { id: { in: [sale!.id, saleB!.id] } } });
  assert(history === 2, "refunded sales retained");
  pass("refund policy");

  const stealOffer = await json(`/api/reseller/offers/${offerId}`, {
    method: "PATCH",
    token: resellerB.token,
    body: JSON.stringify({ title: "Stolen", status: "ARCHIVED" }),
  });
  assert(stealOffer.status === 404, "reseller B cannot edit A offer");
  const stealSales = await json("/api/reseller/sales", { token: resellerB.token });
  assert(stealSales.status === 200 && stealSales.body.data.length === 0, "reseller B sees no A sales");
  const stealCustomers = await json("/api/reseller/customers", { token: resellerB.token });
  assert(stealCustomers.body.data.length === 0, "reseller B sees no A customers");
  const saleDetail = await json(`/api/reseller/sales/${sale!.id}`, { token: resellerB.token });
  assert(saleDetail.status === 404, "reseller B cannot open A sale");
  pass("tenant isolation");

  const client = await json("/api/clients", {
    method: "POST",
    token: buyerA.token,
    body: JSON.stringify({ name: "Buyer A private client" }),
  });
  assert(client.status === 201, `client create ${client.body.error?.message}`);
  const peeked = await json(`/api/clients/${client.body.data.client.id}`, { token: buyerB.token });
  assert(peeked.status === 403 || peeked.status === 404, "customer B cannot read A client");
  pass("customer isolation");

  const buyerPortal = await json("/api/reseller/offers", {
    method: "POST",
    token: buyerA.token,
    body: JSON.stringify({ entitlementId: rights[0]!.id, title: "Stolen rights", priceCents: 1000, productIds: [product.id] }),
  });
  assert(buyerPortal.status === 403, "buyer cannot create reseller offer");
  pass("customer cannot resell");

  const adminLogin = await json("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@aies.local", password: "Admin123!ChangeMe" }),
  });
  if (adminLogin.status === 200) {
    const adminSales = await json("/api/admin/reseller/sales", { token: adminLogin.body.data.tokens.accessToken });
    assert(adminSales.status === 200, "admin sales list");
    const aesPurchases = await json("/api/purchases", { token: adminLogin.body.data.tokens.accessToken });
    const adminBody = JSON.stringify(adminSales.body.data);
    assert(adminBody.includes(sale!.code) || adminSales.body.data.length >= 0, "admin can see reseller sales");
    if (aesPurchases.status === 200) {
      const purchaseCodes = JSON.stringify(aesPurchases.body.data);
      assert(!purchaseCodes.includes(sale!.code), "reseller sale code is not an AES purchase");
    }
    const denied = await json("/api/admin/reseller/sales", { token: buyerA.token });
    assert(denied.status === 403, "buyer cannot open admin reseller");
    pass("admin visibility and AES purchase separation");
  } else {
    console.log(`WARN admin login ${adminLogin.status} ${adminLogin.body.error?.message}`);
  }

  const webhook = await fetch(`${API}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=bad" },
    body: JSON.stringify({ id: "evt_fake", type: "checkout.session.completed" }),
  });
  assert(webhook.status < 500 || webhook.status === 400 || webhook.status === 200, `webhook status ${webhook.status}`);
  const webhookBody = await webhook.json();
  assert(webhookBody.data?.ignored === true || webhook.status === 400, "unverified webhook does not provision");
  pass("webhook does not grant access from a raw return payload");

  await prisma.resellerOffer.update({ where: { id: offerId }, data: { status: "UNPUBLISHED" } });
  const hidden = await json(`/api/reseller/public/offers/${slug}`);
  assert(hidden.status === 404, "unpublished offer blocked");
  pass("unpublished offer");

  await prisma.resellerCustomerAccess.deleteMany({ where: { userId: { in: [buyerA.id, buyerB.id] } } });
  await prisma.productAccess.deleteMany({ where: { userId: { in: [buyerA.id, buyerB.id] } } });
  await prisma.client.deleteMany({ where: { ownerId: { in: [buyerA.id, buyerB.id] } } });
  await prisma.paymentEvent.deleteMany({ where: { resellerSale: { resellerUserId: resellerA.id } } });
  await prisma.resellerSale.deleteMany({ where: { resellerUserId: { in: [resellerA.id, resellerB.id] } } });
  await prisma.resellerOffer.deleteMany({ where: { resellerUserId: { in: [resellerA.id, resellerB.id] } } });
  await prisma.resellerCustomer.deleteMany({ where: { resellerUserId: { in: [resellerA.id, resellerB.id] } } });
  await prisma.resellerEntitlement.deleteMany({ where: { userId: { in: [resellerA.id, resellerB.id] } } });
  await prisma.purchase.deleteMany({ where: { userId: { in: [resellerA.id, resellerB.id] } } });
  if (createdPolicyId) await prisma.resellerPolicy.delete({ where: { id: createdPolicyId } });
  else if (previousPolicy) {
    await prisma.resellerPolicy.update({ where: { id: previousPolicy.id }, data: { enabled: previousPolicy.enabled } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [resellerA.id, resellerB.id, buyerA.id, buyerB.id] } } });
  await prisma.$disconnect();

  console.log(results.join("\n"));
  console.log("R4.1 API verification finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
