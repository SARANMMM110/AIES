/**
 * Phase 6 custom bundles + commercial controls smoke tests.
 * Run: pnpm exec tsx scripts/smoke-phase6-bundles.ts
 * Requires API on API_URL (default http://localhost:4000) and seeded DB.
 */
import { prisma } from "@aes/database";

const API = process.env.API_URL ?? "http://localhost:4000";

async function json<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<{ status: number; body: T }> {
  const headers = new Headers(opts.headers);
  headers.set("Content-Type", "application/json");
  if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

async function loginAdmin() {
  const { status, body } = await json<{
    success: boolean;
    data?: { tokens: { accessToken: string }; user: { id: string } };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@aies.local",
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!ChangeMe",
    }),
  });
  assert(status === 200 && body.success && body.data, `admin login: ${JSON.stringify(body)}`);
  return body.data!;
}

async function registerFreshUser() {
  const email = `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.local`;
  const password = "Buyer123!Test";
  const { status, body } = await json<{
    success: boolean;
    data?: { tokens: { accessToken: string }; user: { id: string } };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      firstName: "Phase",
      lastName: "Six",
    }),
  });
  assert(status === 201 || status === 200, `register failed: ${JSON.stringify(body)}`);
  assert(body.success && body.data, "register envelope");
  return { email, password, token: body.data!.tokens.accessToken, userId: body.data!.user.id };
}

async function main() {
  console.log("Phase 6 bundle smoke @", API);
  const admin = await loginAdmin();

  const productsRes = await json<{
    success: boolean;
    data: { products: Array<{ id: string; slug: string; priceCents: number | null }> };
  }>("/api/products", { token: admin.tokens.accessToken });
  assert(productsRes.status === 200 && productsRes.body.success, "admin products");
  const products = productsRes.body.data.products;
  assert(products.length === 10, `expected 10 products, got ${products.length}`);

  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const localPackIds = [
    "local-presence-agency",
    "local-alliance-agency",
    "referral-loop-agency",
    "trust-builder-agency",
  ].map((s) => bySlug[s].id);

  // TEST A — admin creates Local Growth Pack (unique slug)
  const slug = `local-growth-pack-test-${Date.now()}`;
  const create = await json<{
    success: boolean;
    data: { bundle: { id: string; slug: string; status: string; priceCents: number | null } };
    error?: { message: string };
  }>("/api/bundles", {
    method: "POST",
    token: admin.tokens.accessToken,
    body: JSON.stringify({
      name: "Local Growth Pack Test",
      slug,
      shortDescription: "Test pack",
      priceCents: 79900,
      currency: "USD",
      status: "DRAFT",
      productIds: localPackIds,
    }),
  });
  assert(create.status === 201 && create.body.success, `A create: ${JSON.stringify(create.body)}`);
  const bundleId = create.body.data.bundle.id;
  console.log("OK TEST A create bundle");

  // TEST H — draft not in public catalog
  const catalogDraft = await json<{
    success: boolean;
    data: { bundles: Array<{ slug: string }> };
  }>("/api/catalog");
  assert(catalogDraft.body.success, "catalog");
  assert(
    !catalogDraft.body.data.bundles.some((b) => b.slug === slug),
    "H draft must not be public"
  );
  console.log("OK TEST H draft hidden");

  // TEST B — publish
  const pub = await json<{ success: boolean; data: { bundle: { status: string } } }>(
    `/api/bundles/${bundleId}/publish`,
    { method: "POST", token: admin.tokens.accessToken }
  );
  assert(pub.status === 200 && pub.body.data.bundle.status === "ACTIVE", "B publish");
  const catalogLive = await json<{
    success: boolean;
    data: { bundles: Array<{ slug: string }> };
  }>("/api/catalog");
  assert(
    catalogLive.body.data.bundles.some((b) => b.slug === slug),
    "B visible on catalog"
  );
  console.log("OK TEST B publish + sales catalog");

  // TEST C — purchase bundle
  const buyer = await registerFreshUser();
  const purchase = await json<{
    success: boolean;
    data: {
      purchase: { id: string; purchaseType: string; totalAmount: number; items?: unknown[] };
      grantedProducts: Array<{ slug: string }>;
    };
  }>("/api/purchases", {
    method: "POST",
    token: buyer.token,
    body: JSON.stringify({ items: [{ type: "bundle", slug }] }),
  });
  assert(purchase.status === 201 && purchase.body.success, "C purchase");
  assert(purchase.body.data.purchase.purchaseType === "BUNDLE", "C type BUNDLE");
  assert(purchase.body.data.purchase.totalAmount === 79900, "C server price 79900");
  const dbPurchase = await prisma.purchase.findUnique({
    where: { id: purchase.body.data.purchase.id },
    include: { items: true },
  });
  assert(dbPurchase?.items.length === 1, "C one purchase item");
  assert(dbPurchase?.items[0]?.itemType === "BUNDLE", "C bundle item");
  const accessC = await prisma.productAccess.findMany({
    where: { userId: buyer.userId, status: "ACTIVE" },
    include: { product: true },
  });
  assert(accessC.length === 4, `C 4 product access, got ${accessC.length}`);
  console.log("OK TEST C bundle purchase + access");

  // TEST G — manipulated price ignored (already paid once; new user)
  const buyerG = await registerFreshUser();
  const manip = await json<{
    success: boolean;
    data: { purchase: { totalAmount: number } };
  }>("/api/purchases", {
    method: "POST",
    token: buyerG.token,
    body: JSON.stringify({
      items: [{ type: "bundle", slug, priceCents: 1 }],
    }),
  });
  assert(manip.status === 201, "G purchase accepted without trusting price");
  assert(manip.body.data.purchase.totalAmount === 79900, "G ignores client price");
  console.log("OK TEST G price ignore");

  // TEST F — admin changes price; new purchase uses new price
  await json(`/api/bundles/${bundleId}/price`, {
    method: "PUT",
    token: admin.tokens.accessToken,
    body: JSON.stringify({ priceCents: 85000, currency: "USD" }),
  });
  const buyerF = await registerFreshUser();
  const pF = await json<{ success: boolean; data: { purchase: { totalAmount: number } } }>(
    "/api/purchases",
    {
      method: "POST",
      token: buyerF.token,
      body: JSON.stringify({ items: [{ type: "bundle", slug }] }),
    }
  );
  assert(pF.body.data.purchase.totalAmount === 85000, "F new price used");
  console.log("OK TEST F price change");

  // TEST D — already owns Local Presence, buy overlapping pack
  const buyerD = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerD.token,
    body: JSON.stringify({ items: [{ type: "product", slug: "local-presence-agency" }] }),
  });
  await json("/api/purchases", {
    method: "POST",
    token: buyerD.token,
    body: JSON.stringify({ items: [{ type: "bundle", slug }] }),
  });
  const accessD = await prisma.productAccess.findMany({
    where: { userId: buyerD.userId, status: "ACTIVE", product: { slug: "local-presence-agency" } },
  });
  assert(accessD.length === 1, `D unique Local Presence, got ${accessD.length}`);
  const allD = await prisma.productAccess.count({
    where: { userId: buyerD.userId, status: "ACTIVE" },
  });
  assert(allD === 4, `D still 4 unique products, got ${allD}`);
  console.log("OK TEST D overlap entitlement");

  // TEST E — two overlapping bundles
  const slugB = `overlap-b-${Date.now()}`;
  const createB = await json<{ success: boolean; data: { bundle: { id: string; slug: string } } }>(
    "/api/bundles",
    {
      method: "POST",
      token: admin.tokens.accessToken,
      body: JSON.stringify({
        name: "Overlap B",
        slug: slugB,
        priceCents: 50000,
        status: "ACTIVE",
        productIds: [bySlug["ai-advantage-agency"].id, bySlug["trust-builder-agency"].id],
      }),
    }
  );
  assert(createB.status === 201, "E create second bundle");
  // publish if needed
  if (createB.body.data) {
    await json(`/api/bundles/${createB.body.data.bundle.id}/publish`, {
      method: "POST",
      token: admin.tokens.accessToken,
    });
  }
  const buyerE = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerE.token,
    body: JSON.stringify({
      items: [{ type: "bundle", slug: "ai-enterprise-studio-complete-suite" }],
    }),
  }).catch(() => null);
  // Prefer controlled: buy local pack then overlap B — use fresh user without suite
  const buyerE2 = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerE2.token,
    body: JSON.stringify({
      items: [{ type: "product", slug: "ai-advantage-agency" }, { type: "product", slug: "booking-flow-agency" }],
    }),
  });
  // Create pack A with AI Advantage + Booking
  const slugA = `overlap-a-${Date.now()}`;
  const packA = await json<{ success: boolean; data: { bundle: { id: string } } }>("/api/bundles", {
    method: "POST",
    token: admin.tokens.accessToken,
    body: JSON.stringify({
      name: "Overlap A",
      slug: slugA,
      priceCents: 40000,
      status: "ACTIVE",
      productIds: [bySlug["ai-advantage-agency"].id, bySlug["booking-flow-agency"].id],
    }),
  });
  await json(`/api/bundles/${packA.body.data.bundle.id}/publish`, {
    method: "POST",
    token: admin.tokens.accessToken,
  });
  const buyerE3 = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerE3.token,
    body: JSON.stringify({ items: [{ type: "bundle", slug: slugA }] }),
  });
  await json("/api/purchases", {
    method: "POST",
    token: buyerE3.token,
    body: JSON.stringify({ items: [{ type: "bundle", slug: slugB }] }),
  });
  const eAccess = await prisma.productAccess.findMany({
    where: { userId: buyerE3.userId, status: "ACTIVE" },
    include: { product: true },
  });
  assert(eAccess.length === 3, `E 3 unique products, got ${eAccess.length}`);
  const eSlugs = new Set(eAccess.map((a) => a.product.slug));
  assert(eSlugs.has("ai-advantage-agency") && eSlugs.has("booking-flow-agency") && eSlugs.has("trust-builder-agency"), "E slugs");
  console.log("OK TEST E overlapping bundles");

  // TEST I — unpublish not purchasable
  await json(`/api/bundles/${bundleId}/unpublish`, {
    method: "POST",
    token: admin.tokens.accessToken,
  });
  const buyerI = await registerFreshUser();
  const failI = await json<{ success: boolean }>("/api/purchases", {
    method: "POST",
    token: buyerI.token,
    body: JSON.stringify({ items: [{ type: "bundle", slug }] }),
  });
  assert(failI.status >= 400, "I unpublished not purchasable");
  console.log("OK TEST I unpublished blocked");

  // TEST J/K — manual grant/revoke
  const buyerJ = await registerFreshUser();
  const grant = await json<{ success: boolean; data: { access: { id: string } } }>(
    "/api/access/products/grant",
    {
      method: "POST",
      token: admin.tokens.accessToken,
      body: JSON.stringify({
        userId: buyerJ.userId,
        productId: bySlug["video-authority-agency"].id,
        source: "ADMIN_GRANT",
      }),
    }
  );
  assert(grant.status === 201 || grant.status === 200, "J grant");
  const beforePurchases = await prisma.purchase.count({ where: { userId: buyerJ.userId } });
  assert(beforePurchases === 0, "J no purchase created");
  const checkJ = await prisma.productAccess.count({
    where: {
      userId: buyerJ.userId,
      productId: bySlug["video-authority-agency"].id,
      status: "ACTIVE",
    },
  });
  assert(checkJ === 1, "J access active");
  await json(`/api/access/products/${grant.body.data.access.id}/revoke`, {
    method: "POST",
    token: admin.tokens.accessToken,
  });
  const afterRevoke = await prisma.productAccess.count({
    where: {
      userId: buyerJ.userId,
      productId: bySlug["video-authority-agency"].id,
      status: "ACTIVE",
    },
  });
  assert(afterRevoke === 0, "K revoked");
  assert(
    (await prisma.purchase.count({ where: { userId: buyerJ.userId } })) === 0,
    "K purchases unchanged"
  );
  console.log("OK TEST J/K manual access");

  // TEST L — Complete Suite
  const buyerL = await registerFreshUser();
  const suite = await json<{
    success: boolean;
    data: { grantedProducts: Array<{ slug: string }> };
  }>("/api/purchases", {
    method: "POST",
    token: buyerL.token,
    body: JSON.stringify({
      items: [{ type: "bundle", slug: "ai-enterprise-studio-complete-suite" }],
    }),
  });
  assert(suite.status === 201, "L suite purchase");
  const suiteAccess = await prisma.productAccess.count({
    where: { userId: buyerL.userId, status: "ACTIVE" },
  });
  assert(suiteAccess === 10, `L 10 products, got ${suiteAccess}`);
  console.log("OK TEST L complete suite");

  // TEST M — individual only
  const buyerM = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerM.token,
    body: JSON.stringify({ items: [{ type: "product", slug: "demand-builder-agency" }] }),
  });
  const mCount = await prisma.productAccess.count({
    where: { userId: buyerM.userId, status: "ACTIVE" },
  });
  assert(mCount === 1, "M single product");
  console.log("OK TEST M individual");

  // TEST N — multi product
  const buyerN = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: buyerN.token,
    body: JSON.stringify({
      items: [
        { type: "product", slug: "repeat-revenue-agency" },
        { type: "product", slug: "revenue-revival-agency" },
      ],
    }),
  });
  const nCount = await prisma.productAccess.count({
    where: { userId: buyerN.userId, status: "ACTIVE" },
  });
  assert(nCount === 2, "N two products");
  console.log("OK TEST N multi-product");

  // TEST O — catalog counts (workflows via validate-like check)
  const productCount = await prisma.product.count({
    where: { slug: { in: products.map((p) => p.slug) } },
  });
  const serviceCount = await prisma.productResource.count({
    where: { type: "SERVICE", product: { slug: { in: products.map((p) => p.slug) } } },
  });
  const workflowCount = await prisma.workflowDefinition.count({
    where: { product: { slug: { in: products.map((p) => p.slug) } } },
  });
  assert(productCount === 10, "O products 10");
  assert(serviceCount === 99, `O services 99 got ${serviceCount}`);
  assert(workflowCount === 306, `O workflows 306 got ${workflowCount}`);
  console.log("OK TEST O catalog counts 10/99/306");

  // Analytics endpoint
  const analytics = await json<{ success: boolean }>("/api/purchases/analytics/summary", {
    token: admin.tokens.accessToken,
  });
  assert(analytics.status === 200 && analytics.body.success, "analytics");

  // Archive test bundles
  await json(`/api/bundles/${bundleId}`, { method: "DELETE", token: admin.tokens.accessToken });
  await json(`/api/bundles/${packA.body.data.bundle.id}`, {
    method: "DELETE",
    token: admin.tokens.accessToken,
  });
  await json(`/api/bundles/${createB.body.data.bundle.id}`, {
    method: "DELETE",
    token: admin.tokens.accessToken,
  });

  console.log("\nPhase 6 smoke PASSED");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
