/**
 * Stage 4 export smoke test.
 * Requires API running on localhost:4000.
 */
const API = process.env.API_URL || "http://localhost:4000";

async function login(email: string, password: string) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(`login failed: ${JSON.stringify(j)}`);
  return j.data.tokens.accessToken as string;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const admin = await login("admin@aies.local", "Admin123!ChangeMe");
  const user = await login("user@aies.local", "User123!ChangeMe");

  const deep = ["ai-advantage-agency", "booking-flow-agency", "revenue-revival-agency"];
  const expected: Record<string, number> = {
    "ai-advantage-agency": 31,
    "booking-flow-agency": 31,
    "demand-builder-agency": 31,
    "local-alliance-agency": 31,
    "local-presence-agency": 30,
    "referral-loop-agency": 31,
    "repeat-revenue-agency": 31,
    "revenue-revival-agency": 29,
    "trust-builder-agency": 30,
    "video-authority-agency": 31,
  };

  for (const slug of deep) {
    const res = await fetch(`${API}/api/products/${slug}/export/standalone?format=json`, {
      headers: headers(admin),
    });
    const j = await res.json();
    if (!j.success) throw new Error(`export fail ${slug}: ${JSON.stringify(j)}`);
    const html = j.data.html as string;
    if (!html.includes(slug)) throw new Error(`${slug} html missing slug`);
    if (!html.includes("aes_standalone_")) throw new Error(`${slug} missing localStorage keys`);
    if (!html.includes("__AES_PRODUCT__")) throw new Error(`${slug} missing embedded data`);
    if (html.includes("Bearer ") || html.includes("passwordHash")) {
      throw new Error(`${slug} appears to leak secrets`);
    }
    // Standalone runtime must not call localhost APIs
    if (/fetch\s*\(\s*[`'"]https?:\/\/localhost/.test(html)) {
      throw new Error(`${slug} standalone still fetches localhost`);
    }
    const count = expected[slug];
    if (j.data.manifestMeta.workflowCount !== count) {
      throw new Error(
        `${slug} workflowCount ${j.data.manifestMeta.workflowCount} != ${count}`
      );
    }
    console.log(
      "deep export OK",
      slug,
      "wf",
      j.data.manifestMeta.workflowCount,
      "bytes",
      j.data.manifestMeta.bytes
    );
  }

  // user denied for ungranted
  const denied = await fetch(
    `${API}/api/products/video-authority-agency/export/standalone?format=json`,
    { headers: headers(user) }
  );
  if (denied.status !== 403) throw new Error(`expected 403 export, got ${denied.status}`);
  console.log("ungranted export 403 OK");

  let total = 0;
  for (const slug of Object.keys(expected)) {
    const res = await fetch(`${API}/api/products/${slug}/export/standalone?format=json`, {
      headers: headers(admin),
    });
    const j = await res.json();
    if (!j.success) throw new Error(`export all fail ${slug}`);
    if (j.data.manifestMeta.workflowCount !== expected[slug]) {
      throw new Error(`count mismatch ${slug}`);
    }
    total += j.data.manifestMeta.workflowCount;
    console.log("export OK", slug, j.data.manifestMeta.workflowCount);
  }
  if (total !== 306) throw new Error(`total workflows in exports ${total} != 306`);
  console.log("STAGE4 EXPORT SMOKE PASS total workflows", total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
