/**
 * R5 reseller portal smoke. Does not change payment architecture.
 * Run: pnpm --filter @aes/api exec tsx ../../scripts/smoke-reseller-portal.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";

const API = process.env.API_URL ?? "http://localhost:4000";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type Json = { success: boolean; data?: any; error?: { message: string } };

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
  const stamp = Date.now();
  const password = "Portal123!Test";
  async function register(prefix: string) {
    const email = `${prefix}.${stamp}@test.local`;
    const res = await json("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, firstName: prefix, lastName: "R5" }),
    });
    assert(res.status === 201 || res.status === 200, `register ${prefix}`);
    return { email, token: res.body.data.tokens.accessToken as string, id: res.body.data.user.id as string };
  }

  const reseller = await register("portal");
  const other = await register("other");
  const buyer = await register("buyer");
  const product = await prisma.product.findFirst({ where: { slug: "booking-flow-agency", status: "PUBLISHED" } });
  assert(product, "catalog product");
  const previous = await prisma.resellerPolicy.findUnique({ where: { productId: product.id } });
  if (previous) await prisma.resellerPolicy.update({ where: { id: previous.id }, data: { enabled: true, allowBranding: true } });
  else await prisma.resellerPolicy.create({ data: { scope: "PRODUCT", productId: product.id, enabled: true, allowBranding: true } });

  const purchase = await prisma.purchase.create({
    data: {
      code: `PUR-R5${String(stamp).slice(-6)}`,
      userId: reseller.id,
      status: "COMPLETED",
      purchaseType: "PRODUCT",
      totalAmount: 39900,
      subtotalAmount: 39900,
      currency: "USD",
      paymentStatus: "SIMULATED",
      items: { create: { itemType: "PRODUCT", productId: product.id, price: 39900 } },
    },
  });
  const { grantResellerEntitlementsForPurchase } = await import("../apps/api/src/modules/reseller/entitlements");
  const rights = await grantResellerEntitlementsForPurchase(prisma, purchase.id);
  assert(rights[0]?.status === "ACTIVE", "entitlement");

  const me = await json("/api/reseller/me", { token: reseller.token });
  assert(me.status === 200 && me.body.data.stats, "dashboard");
  const entitlements = await json("/api/reseller/entitlements", { token: reseller.token });
  assert(entitlements.status === 200 && entitlements.body.data[0].canResell === true, "entitlements");

  const created = await json("/api/reseller/offers", {
    method: "POST",
    token: reseller.token,
    body: JSON.stringify({
      entitlementId: rights[0]!.id,
      title: `Portal Offer ${stamp}`,
      description: "Customer-facing booking offer.",
      salesCopy: "Book more calls.",
      ctaText: "Get access",
      priceCents: 59900,
      currency: "USD",
      productIds: [product.id],
      status: "DRAFT",
    }),
  });
  assert(created.status === 201, `create ${created.body.error?.message}`);
  const offerId = created.body.data.id as string;

  const edited = await json(`/api/reseller/offers/${offerId}`, {
    method: "PATCH",
    token: reseller.token,
    body: JSON.stringify({ description: "Updated copy" }),
  });
  assert(edited.status === 200, "edit");

  const before = await prisma.resellerSale.count({ where: { offerId } });
  const preview = await json(`/api/reseller/offers/${offerId}/preview`, { token: reseller.token });
  assert(preview.status === 200 && preview.body.data.preview === true, "preview");
  assert((await prisma.resellerSale.count({ where: { offerId } })) === before, "preview creates no sale");

  const published = await json(`/api/reseller/offers/${offerId}/publish`, { method: "POST", token: reseller.token });
  assert(published.status === 200 && published.body.data.status === "PUBLISHED", "publish");
  const slug = published.body.data.slug as string;
  const pub = await json(`/api/reseller/public/offers/${slug}`);
  assert(pub.status === 200 && pub.body.data.priceCents === 59900, "public offer");
  assert(pub.body.data.attribution?.includes("AI Enterprise Studio"), "attribution");

  const brand = await json("/api/reseller/branding", {
    method: "PUT",
    token: reseller.token,
    body: JSON.stringify({ brandName: "ABC Growth Solutions", primaryColor: "#12324a", supportEmail: "hello@example.com", website: "https://example.com" }),
  });
  assert(brand.status === 200 && brand.body.data.brandName === "ABC Growth Solutions", "branding");
  const logo = await json("/api/reseller/branding/logo", {
    method: "POST",
    token: reseller.token,
    body: JSON.stringify({ dataUrl: PNG }),
  });
  assert(logo.status === 200 && String(logo.body.data.logoUrl).includes(reseller.id), "logo ownership");
  const stolen = await json("/api/reseller/branding", { token: other.token });
  assert(stolen.status === 403, "other reseller cannot read branding via portal without rights");

  const checkout = await json(`/api/reseller/public/offers/${slug}/checkout`, { method: "POST", token: buyer.token });
  assert(checkout.status === 201, `checkout ${checkout.body.error?.message}`);
  const customers = await json("/api/reseller/customers", { token: reseller.token });
  assert(customers.body.data.some((row: { email: string }) => row.email === buyer.email), "customer visible");
  const sales = await json("/api/reseller/sales", { token: reseller.token });
  assert(sales.body.data.some((row: { customer: { email: string } }) => row.customer.email === buyer.email), "sale visible");
  const analytics = await json("/api/reseller/analytics", { token: reseller.token });
  assert(analytics.status === 200 && analytics.body.data.totals.views >= 1, "analytics from recorded views");

  const foreign = await json(`/api/reseller/offers/${offerId}`, { method: "PATCH", token: other.token, body: JSON.stringify({ title: "Hijack" }) });
  assert(foreign.status === 403 || foreign.status === 404, "tenant isolation");
  const customerId = customers.body.data.find((row: { email: string }) => row.email === buyer.email).id;
  const foreignCustomer = await json(`/api/reseller/customers/${customerId}`, { token: other.token });
  assert(foreignCustomer.status === 403 || foreignCustomer.status === 404, "customer isolation");
  const buyerPortal = await json("/api/reseller/offers", { token: buyer.token });
  assert(buyerPortal.status === 403, "customer denied reseller API");

  const archived = await json(`/api/reseller/offers/${offerId}/archive`, { method: "POST", token: reseller.token });
  assert(archived.status === 200, "archive");
  const gone = await json(`/api/reseller/public/offers/${slug}`);
  assert(gone.status === 404, "archived offer not public");
  const history = await json("/api/reseller/sales", { token: reseller.token });
  assert(history.body.data.length >= 1, "archived offer keeps sales");

  await prisma.user.deleteMany({ where: { id: { in: [reseller.id, other.id, buyer.id] } } });
  console.log("R5 reseller portal smoke passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
