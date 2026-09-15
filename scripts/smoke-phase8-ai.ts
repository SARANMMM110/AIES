/**
 * Phase 8 AI smoke — no real provider keys required.
 * Verifies fallback behavior when AI_PROVIDER=none.
 */
const API = process.env.API_URL || "http://localhost:4000";
const USER_EMAIL = process.env.SMOKE_USER_EMAIL || "user@aies.local";
const USER_PASSWORD = process.env.SMOKE_USER_PASSWORD || "User123!ChangeMe";

async function login(email: string, password: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error("login failed");
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
  console.log("Phase 8 AI smoke…");
  const user = await login(USER_EMAIL, USER_PASSWORD);

  const ask = await api(user, "/api/wiki/ask", {
    method: "POST",
    body: JSON.stringify({ question: "How do I price my first service?" }),
  });
  assert(ask.status === 200, "ask wiki");
  assert(
    ask.json.data.mode === "search-retrieval" ||
      ask.json.data.mode === "grounded-answer" ||
      ask.json.data.mode === "insufficient-context",
    "ask mode"
  );
  assert(Array.isArray(ask.json.data.recommendedReading), "recommended reading");
  if (ask.json.data.mode === "search-retrieval") {
    assert(ask.json.data.recommendedReading.length > 0, "pricing retrieval empty");
  }
  if (ask.json.data.mode === "grounded-answer") {
    assert(ask.json.data.answer, "grounded answer missing");
    assert((ask.json.data.sources || ask.json.data.recommendedReading).length > 0, "citations");
  }

  // Workflow generate without AI key should 503
  const products = await api(user, "/api/products/available");
  const slug = products.json.data?.products?.[0]?.slug || "booking-flow-agency";
  const wfs = await api(user, `/api/products/${slug}/workflows`);
  const wfId = wfs.json.data?.workflows?.[0]?.id;
  assert(wfId, "workflow id");

  const gen = await api(user, "/api/workflows/engine/generate", {
    method: "POST",
    body: JSON.stringify({
      workflowId: wfId,
      instruction: "Draft a short discovery agenda for a local services client.",
      inputs: {},
    }),
  });
  // none provider → 503; if AI configured in env, 200 is also OK
  assert(
    gen.status === 503 || gen.status === 200 || gen.status === 502 || gen.status === 429,
    `unexpected generate status ${gen.status}`
  );
  if (gen.status === 503) {
    assert(gen.json.error?.code === "AI_NOT_CONFIGURED", "expected AI_NOT_CONFIGURED");
  }

  console.log("Phase 8 AI smoke PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
