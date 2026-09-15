/**
 * Smoke test: AI Advantage Agency Workflow 1 end-to-end via API.
 * Requires API on :4000 and seeded DB.
 *
 * Run: pnpm exec tsx scripts/smoke-workflow1-ai-advantage.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../apps/api/.env") });

const API = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@aies.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin123!ChangeMe";

const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const PRODUCT_SLUG = "ai-advantage-agency";
const SERVICE_TITLE = "AI Readiness and Opportunity Audit";

async function req(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status} ${json.error?.message || JSON.stringify(json)}`);
  }
  return json.data;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  console.log("Workflow 1 smoke — AI Advantage Agency");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.tokens?.accessToken || login.token) as string;
  assert(token, "login token");

  const product = (await req(`/api/products/${PRODUCT_SLUG}`, { token })).product;
  assert(product.slug === PRODUCT_SLUG, "product slug");
  assert(!/agency building/i.test(product.name), "no Agency Building product");

  const { workflows } = await req(`/api/products/${PRODUCT_SLUG}/workflows`, { token });
  const wf1 = workflows.find(
    (w: { key: string; displayOrder: number }) =>
      w.key === WF1_KEY || w.displayOrder === 1
  );
  assert(wf1, "Workflow 1 found");
  assert(wf1.key === WF1_KEY, `expected key ${WF1_KEY}, got ${wf1.key}`);
  assert(wf1.serviceResourceId, "Workflow 1 has serviceResourceId");
  assert(Array.isArray(wf1.inputs) && wf1.inputs.length > 0, "Workflow 1 has inputs schema");
  assert(
    wf1.reviewRequirements?.checklist?.length > 0,
    "Workflow 1 has review checklist"
  );

  const def = (await req(`/api/workflows/definitions/${wf1.id}`, { token })).workflow;
  assert(def.product.slug === PRODUCT_SLUG, "definition product");
  assert(def.serviceResource?.title === SERVICE_TITLE, `service=${def.serviceResource?.title}`);
  assert(def.id === wf1.id, "id match");

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string; name: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: "WF1 Smoke Client",
        industry: "Professional services",
        location: "Austin, TX",
        goals: "Assess AI readiness",
      }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF1 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prepare = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Smoke Dental\nIndustry: Healthcare\nLocation: Austin",
        service_focus: SERVICE_TITLE,
        goals: "Produce a readiness assessment for AI enablement",
        constraints: "No autonomous outreach",
        additional_notes: "Smoke test notes",
      },
    }),
  });

  assert(prepare.ready === true, "prepare ready");
  assert(prepare.instruction?.length > 100, "instruction length");
  assert(/AI Readiness|readiness/i.test(prepare.instruction), "instruction mentions readiness");
  assert(!/Agency Building/i.test(prepare.instruction), "instruction must not say Agency Building");
  assert(prepare.context.service?.title === SERVICE_TITLE, "prepare service");
  assert(prepare.context.workflow.id === wf1.id, "prepare workflow id");

  const saved = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      instruction: prepare.instruction,
      output: "## Smoke readiness report\n\nFindings: baseline complete.",
      reviewStatus: "APPROVED",
      title: `${wf1.name} — smoke`,
      inputs: {
        client_context: "Business: Smoke Dental",
        service_focus: SERVICE_TITLE,
        goals: "Produce a readiness assessment",
      },
    }),
  });

  assert(saved.result?.id, "result id");
  assert(saved.result.workflowKey === wf1.key, "result workflowKey");
  assert(saved.result.metadata?.productId === product.id, "result productId");
  assert(saved.result.metadata?.serviceResourceId === wf1.serviceResourceId, "result serviceId");

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;
  assert(
    results.some((r) => r.id === saved.result.id && r.workflowKey === wf1.key),
    "result restorable by project"
  );

  console.log("PASS — Workflow 1");
  console.log(`  ${wf1.name}`);
  console.log(`  service: ${SERVICE_TITLE}`);
  console.log(`  workflowId: ${wf1.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
