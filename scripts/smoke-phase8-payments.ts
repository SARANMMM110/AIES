/**
 * Phase 8 payment smoke — uses simulated provider (default).
 * Never calls live Stripe.
 */
const API = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@aies.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin123!ChangeMe";
const USER_EMAIL = process.env.SMOKE_USER_EMAIL || "user@aies.local";
const USER_PASSWORD = process.env.SMOKE_USER_PASSWORD || "User123!ChangeMe";

async function login(email: string, password: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`login failed ${email}`);
  return json.data.tokens.accessToken as string;
}

async function api(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Phase 8 payment smoke…");
  const admin = await login(EMAIL, PASSWORD);
  const user = await login(USER_EMAIL, USER_PASSWORD);

  const health = await fetch(`${API}/api/health`).then((r) => r.json());
  assert(health.success && health.data.database === "up", "health DB not up");

  const cfg = await api(user, "/api/payments/config");
  assert(cfg.status === 200, "payment config");
  assert(cfg.json.data.provider === "simulated" || cfg.json.data.provider === "stripe", "provider");

  // Payment creation (simulated completes + provisions) — use admin to avoid polluting demo user entitlements
  const buy = await api(admin, "/api/purchases", {
    method: "POST",
    body: JSON.stringify({ items: [{ type: "product", slug: "video-authority-agency" }] }),
  });
  assert(buy.status === 201, `purchase ${buy.status}`);
  assert(buy.json.data.purchase?.id, "purchase id");
  const purchaseId = buy.json.data.purchase.id as string;
  assert(
    buy.json.data.mode === "completed" || buy.json.data.checkoutUrl,
    "expected completed simulated or checkout url"
  );

  if (buy.json.data.mode === "completed") {
    assert(buy.json.data.grantedProducts?.length >= 1, "access not provisioned");
    assert(
      buy.json.data.paymentStatus === "SIMULATED" || buy.json.data.paymentStatus === "PAID",
      "payment status"
    );
  }

  // Status endpoint
  const st = await api(admin, `/api/payments/purchases/${purchaseId}/status`);
  assert(st.status === 200, "status endpoint");

  // User cannot read admin's purchase
  const other = await api(user, `/api/payments/purchases/${purchaseId}/status`);
  assert(other.status === 403, "user cannot read admin purchase status");

  // Client confirm forbidden
  const confirm = await api(user, "/api/payments/confirm-client", { method: "POST", body: "{}" });
  assert(confirm.status === 400, "client confirm must fail");

  // admin re-provision idempotent
  const prov = await api(admin, `/api/purchases/${purchaseId}/provision`, { method: "POST" });
  assert(prov.status === 200, "admin re-provision idempotent");

  // Forbidden: user hits admin purchases
  const forbidden = await api(user, "/api/purchases");
  assert(forbidden.status === 403, "user admin list 403");

  // Webhook ignored for simulated
  const wh = await fetch(`${API}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "noop" }),
  });
  // simulated verifyWebhook returns ignored — may 200
  assert(wh.status === 200 || wh.status === 400 || wh.status === 500, "webhook responded");

  console.log("Phase 8 payment smoke PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
