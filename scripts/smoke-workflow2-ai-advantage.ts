/**
 * Smoke: AI Advantage Workflow 2 + Workflow 1 regression.
 * Requires API :4000 and seeded DB.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../apps/api/.env") });

const API = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@aies.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin123!ChangeMe";

const PRODUCT_SLUG = "ai-advantage-agency";
const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const WF2_KEY = "ai-readiness-and-opportunity-audit-system-design";
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
    throw new Error(
      `${opts.method || "GET"} ${path} → ${res.status} ${json.error?.message || JSON.stringify(json)}`
    );
  }
  return json.data;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  console.log("Workflow 2 smoke + Workflow 1 regression — AI Advantage Agency");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.tokens?.accessToken || login.token) as string;
  assert(token, "login token");

  const product = (await req(`/api/products/${PRODUCT_SLUG}`, { token })).product;
  assert(product.slug === PRODUCT_SLUG, "product");

  const { workflows } = await req(`/api/products/${PRODUCT_SLUG}/workflows`, { token });
  const sorted = [...workflows].sort(
    (a: { displayOrder: number }, b: { displayOrder: number }) =>
      a.displayOrder - b.displayOrder
  );

  const wf1 = workflows.find((w: { key: string }) => w.key === WF1_KEY);
  const wf2 = workflows.find((w: { key: string }) => w.key === WF2_KEY);
  assert(wf1, `WF1 key ${WF1_KEY}`);
  assert(wf2, `WF2 key ${WF2_KEY}`);
  assert(sorted[0].id === wf1.id, "displayOrder 1 is WF1");
  assert(sorted[1].id === wf2.id, "displayOrder 2 is WF2");
  assert(wf1.id !== wf2.id, "distinct workflow ids");
  assert(wf1.serviceResourceId === wf2.serviceResourceId, "same service for WF1/WF2 (first service)");
  assert(wf1.serviceResourceId, "service mapping");
  assert(!/agency building/i.test(wf2.name), "no Agency Building");

  const def2 = (await req(`/api/workflows/definitions/${wf2.id}`, { token })).workflow;
  assert(def2.product.slug === PRODUCT_SLUG, "WF2 product");
  assert(def2.serviceResource?.title === SERVICE_TITLE, `WF2 service=${def2.serviceResource?.title}`);
  assert(def2.name.includes("System Design"), `WF2 name=${def2.name}`);
  assert(Array.isArray(def2.inputs) && def2.inputs.length > 0, "WF2 inputs");
  const wf2Keys = def2.inputs.map((i: { key: string }) => i.key);
  assert(wf2Keys.includes("priority_opportunity"), "WF2 has priority_opportunity input");
  assert(
    !(
      await req(`/api/workflows/definitions/${wf1.id}`, { token })
    ).workflow.inputs.some((i: { key: string }) => i.key === "priority_opportunity"),
    "WF1 must not require priority_opportunity"
  );
  assert(def2.reviewRequirements?.checklist?.length > 0, "WF2 review");
  assert(
    /enablement system design/i.test(
      JSON.stringify(def2.outputDefinition) + JSON.stringify(def2.reviewRequirements)
    ) || /system design/i.test(def2.purpose),
    "WF2 purpose/output is system design (not readiness-only)"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF2 Smoke Client", industry: "Services", location: "Denver" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF2 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  // --- Workflow 2 prepare + save ---
  const prep2 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf2.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental\nIndustry: Healthcare",
        service_focus: SERVICE_TITLE,
        goals: "Design an enablement system for priority AI opportunity",
        constraints: "Human approval required",
        additional_notes: "WF2 smoke",
        priority_opportunity: "Faster enquiry triage with human review",
        existing_tools: "Email + shared inbox",
      },
    }),
  });
  assert(prep2.ready, "WF2 prepare ready");
  assert(prep2.context.workflow.id === wf2.id, "prepare uses WF2 id");
  assert(prep2.context.service?.id === wf2.serviceResourceId, "prepare service id");
  assert(/system design|enablement system/i.test(prep2.instruction), "WF2-specific instruction");
  assert(!/Agency Building/i.test(prep2.instruction), "no Agency Building in prompt");
  assert(prep2.instruction !== undefined, "instruction present");

  const save2 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf2.id,
      projectId: project.id,
      instruction: prep2.instruction,
      output: "## WF2 System Design smoke\nRoles and ownership outlined.",
      reviewStatus: "APPROVED",
      title: `${wf2.name} — smoke`,
      inputs: { service_focus: SERVICE_TITLE, goals: "Design enablement system" },
    }),
  });
  assert(save2.result.workflowKey === wf2.key, "save WF2 key");
  assert(save2.result.metadata.productId === product.id, "save product");
  assert(save2.result.metadata.serviceResourceId === wf2.serviceResourceId, "save service");

  // --- Workflow 1 regression ---
  const prep1 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_TITLE,
        goals: "Assess AI readiness",
        constraints: "No autonomous outreach",
      },
    }),
  });
  assert(prep1.ready, "WF1 still prepares");
  assert(prep1.context.workflow.id === wf1.id, "WF1 id");
  assert(/readiness/i.test(prep1.instruction), "WF1 readiness instruction");
  assert(prep1.instruction !== prep2.instruction, "WF1 and WF2 prompts differ");

  const save1 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      instruction: prep1.instruction,
      output: "## WF1 Readiness smoke\nScorecard complete.",
      reviewStatus: "APPROVED",
      title: `${wf1.name} — smoke`,
      inputs: { service_focus: SERVICE_TITLE, goals: "Assess readiness" },
    }),
  });
  assert(save1.result.workflowKey === wf1.key, "WF1 save key");
  assert(save1.result.id !== save2.result.id, "distinct result rows");

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string; content: { finalOutput?: string } }>;

  const r1 = results.filter((r) => r.workflowKey === wf1.key);
  const r2 = results.filter((r) => r.workflowKey === wf2.key);
  assert(r1.some((r) => r.id === save1.result.id), "WF1 result restorable");
  assert(r2.some((r) => r.id === save2.result.id), "WF2 result restorable");
  assert(
    !r2.some((r) => r.id === save1.result.id),
    "WF1 result must not appear as WF2"
  );
  assert(
    !r1.some((r) => /WF2 System Design/i.test(r.content?.finalOutput || "")),
    "WF2 content not in WF1 list"
  );

  console.log("PASS — Workflow 2 + Workflow 1 regression");
  console.log(`  WF2: ${wf2.name}`);
  console.log(`  service: ${SERVICE_TITLE}`);
  console.log(`  workflowId: ${wf2.id}`);
  console.log(`  WF1 still OK: ${wf1.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
