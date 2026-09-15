/**
 * Phase 5 purchase + access provisioning smoke tests.
 * Run: pnpm --filter @aes/database exec tsx ../../scripts/smoke-phase5-purchases.ts
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

async function registerFreshUser() {
  const email = `buyer_${Date.now()}@test.local`;
  const password = "Buyer123!Test";
  const { status, body } = await json<{
    success: boolean;
    data?: { tokens: { accessToken: string }; user: { id: string } };
    error?: { message: string };
  }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      firstName: "Phase",
      lastName: "Five",
    }),
  });
  assert(status === 201 || status === 200, `register failed: ${JSON.stringify(body)}`);
  assert(body.success && body.data, "register envelope");
  return { email, password, token: body.data!.tokens.accessToken, userId: body.data!.user.id };
}

async function main() {
  console.log("Phase 5 purchase smoke @", API);

  // TEST 1 — individual AI Advantage
  const u1 = await registerFreshUser();
  const p1 = await json<{
    success: boolean;
    data: {
      purchase: { id: string; code: string; purchaseType: string; totalAmount: number };
      grantedProducts: Array<{ slug: string }>;
    };
  }>("/api/purchases", {
    method: "POST",
    token: u1.token,
    body: JSON.stringify({
      items: [{ type: "product", slug: "ai-advantage-agency" }],
    }),
  });
  assert(p1.status === 201 && p1.body.success, "T1 purchase create");
  assert(p1.body.data.purchase.purchaseType === "PRODUCT", "T1 type PRODUCT");
  assert(p1.body.data.grantedProducts.some((g) => g.slug === "ai-advantage-agency"), "T1 access AI Advantage");
  const access1 = await prisma.productAccess.count({
    where: { userId: u1.userId, status: "ACTIVE" },
  });
  assert(access1 === 1, `T1 exactly 1 product access, got ${access1}`);
  console.log("OK TEST 1 individual purchase");

  // TEST 2 — second product keeps first
  const p2 = await json<{ success: boolean }>("/api/purchases", {
    method: "POST",
    token: u1.token,
    body: JSON.stringify({
      items: [{ type: "product", slug: "booking-flow-agency" }],
    }),
  });
  assert(p2.status === 201 && p2.body.success, "T2 booking purchase");
  const access2 = await prisma.productAccess.findMany({
    where: { userId: u1.userId, status: "ACTIVE" },
    include: { product: true },
  });
  assert(access2.length === 2, `T2 two accesses, got ${access2.length}`);
  assert(
    access2.some((a) => a.product.slug === "ai-advantage-agency") &&
      access2.some((a) => a.product.slug === "booking-flow-agency"),
    "T2 both products"
  );
  console.log("OK TEST 2 second individual purchase");

  // TEST 3 — multi product one purchase
  const u3 = await registerFreshUser();
  const p3 = await json<{
    success: boolean;
    data: {
      purchase: { id: string; purchaseType: string };
      grantedProducts: Array<{ slug: string }>;
    };
  }>("/api/purchases", {
    method: "POST",
    token: u3.token,
    body: JSON.stringify({
      items: [
        { type: "product", slug: "ai-advantage-agency" },
        { type: "product", slug: "booking-flow-agency" },
        { type: "product", slug: "trust-builder-agency" },
      ],
    }),
  });
  assert(p3.status === 201, "T3 create");
  assert(p3.body.data.purchase.purchaseType === "MULTI_PRODUCT", "T3 MULTI_PRODUCT");
  const items3 = await prisma.purchaseItem.count({ where: { purchaseId: p3.body.data.purchase.id } });
  assert(items3 === 3, `T3 three items, got ${items3}`);
  const access3 = await prisma.productAccess.count({
    where: { userId: u3.userId, status: "ACTIVE" },
  });
  assert(access3 === 3, `T3 three accesses, got ${access3}`);
  console.log("OK TEST 3 multi-product");

  // TEST 4 — complete suite
  const u4 = await registerFreshUser();
  const p4 = await json<{
    success: boolean;
    data: { purchase: { id: string; purchaseType: string }; grantedProducts: Array<{ slug: string }> };
  }>("/api/purchases", {
    method: "POST",
    token: u4.token,
    body: JSON.stringify({
      items: [{ type: "bundle", slug: "ai-enterprise-studio-complete-suite" }],
    }),
  });
  assert(p4.status === 201, "T4 suite");
  assert(p4.body.data.purchase.purchaseType === "BUNDLE", "T4 BUNDLE");
  const items4 = await prisma.purchaseItem.count({ where: { purchaseId: p4.body.data.purchase.id } });
  assert(items4 === 1, "T4 one bundle item");
  const access4 = await prisma.productAccess.count({
    where: { userId: u4.userId, status: "ACTIVE" },
  });
  assert(access4 === 10, `T4 ten product accesses, got ${access4}`);
  console.log("OK TEST 4 complete suite");

  // TEST 5 — suite after owning one (no duplicate)
  const u5 = await registerFreshUser();
  await json("/api/purchases", {
    method: "POST",
    token: u5.token,
    body: JSON.stringify({ items: [{ type: "product", slug: "ai-advantage-agency" }] }),
  });
  await json("/api/purchases", {
    method: "POST",
    token: u5.token,
    body: JSON.stringify({
      items: [{ type: "bundle", slug: "ai-enterprise-studio-complete-suite" }],
    }),
  });
  const access5 = await prisma.productAccess.findMany({
    where: { userId: u5.userId, status: "ACTIVE" },
  });
  const byProduct = new Map<string, number>();
  for (const a of access5) {
    byProduct.set(a.productId, (byProduct.get(a.productId) ?? 0) + 1);
  }
  assert(access5.length === 10, `T5 ten entitlements, got ${access5.length}`);
  assert([...byProduct.values()].every((n) => n === 1), "T5 no duplicate product access rows per product");
  console.log("OK TEST 5 suite after individual (no dupes)");

  // TEST 6 — unowned product denied
  const u6 = await registerFreshUser();
  const products = await prisma.product.findMany({ where: { slug: "demand-builder-agency" } });
  const denied = await json(`/api/products/${products[0].id}`, { token: u6.token });
  // list/detail may vary; check access check endpoint
  const check = await json<{ success: boolean; data: { hasAccess: boolean } }>(
    `/api/access/me/products/${products[0].id}/check`,
    { token: u6.token }
  );
  assert(check.body.data.hasAccess === false, "T6 no access");
  console.log("OK TEST 6 unowned access denied");
  void denied;

  // TEST 7 — client price ignored
  const u7 = await registerFreshUser();
  const before = await prisma.product.findUnique({ where: { slug: "ai-advantage-agency" } });
  const p7 = await json<{
    success: boolean;
    data: { purchase: { totalAmount: number } };
  }>("/api/purchases", {
    method: "POST",
    token: u7.token,
    body: JSON.stringify({
      items: [{ type: "product", slug: "ai-advantage-agency" }],
      totalAmount: 1,
      priceCents: 1,
    }),
  });
  assert(p7.body.data.purchase.totalAmount === (before?.priceCents ?? 0), "T7 server price wins");
  console.log("OK TEST 7 server-side pricing");

  // TEST 8 — re-provision idempotent
  const purchaseId = p1.body.data.purchase.id;
  const beforeCount = await prisma.productAccess.count({ where: { userId: u1.userId } });
  // login admin for provision endpoint
  const adminLogin = await json<{
    success: boolean;
    data: { tokens: { accessToken: string } };
  }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@aies.local",
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!ChangeMe",
    }),
  });
  assert(adminLogin.body.success, "admin login");
  await json(`/api/purchases/${purchaseId}/provision`, {
    method: "POST",
    token: adminLogin.body.data.tokens.accessToken,
  });
  const afterCount = await prisma.productAccess.count({ where: { userId: u1.userId } });
  assert(afterCount === beforeCount, `T8 no new access rows (${beforeCount} → ${afterCount})`);
  console.log("OK TEST 8 idempotent provision");

  // TEST 9 — admin list
  const adminList = await json<{ success: boolean; data: { purchases: unknown[] } }>(
    "/api/purchases?limit=10",
    { token: adminLogin.body.data.tokens.accessToken }
  );
  assert(adminList.status === 200 && adminList.body.data.purchases.length > 0, "T9 admin list");
  console.log("OK TEST 9 admin purchases");

  console.log("\nAll Phase 5 purchase smoke tests passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
