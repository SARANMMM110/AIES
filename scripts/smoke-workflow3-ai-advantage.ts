/**
 * Smoke: AI Advantage Workflow 3 + Workflow 1/2 regression.
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
const SERVICE_TITLE = "AI Readiness and Opportunity Audit";
const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const WF2_KEY = "ai-readiness-and-opportunity-audit-system-design";
const WF3_KEY = "ai-readiness-and-opportunity-audit-implementation-playbook";

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
  console.log("Workflow 3 smoke + WF1/WF2 regression — AI Advantage Agency");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.tokens?.accessToken || login.token) as string;
  assert(token, "login token");

  const product = (await req(`/api/products/${PRODUCT_SLUG}`, { token })).product;
  const { workflows } = await req(`/api/products/${PRODUCT_SLUG}/workflows`, { token });
  assert(workflows.length === 31, `AI Advantage workflows=${workflows.length}`);

  const sorted = [...workflows].sort(
    (a: { displayOrder: number }, b: { displayOrder: number }) =>
      a.displayOrder - b.displayOrder
  );
  const wf1 = workflows.find((w: { key: string }) => w.key === WF1_KEY);
  const wf2 = workflows.find((w: { key: string }) => w.key === WF2_KEY);
  const wf3 = workflows.find((w: { key: string }) => w.key === WF3_KEY);
  assert(wf1 && wf2 && wf3, "WF1/2/3 keys present");
  assert(sorted[0].id === wf1.id && sorted[0].displayOrder === 1, "order 1");
  assert(sorted[1].id === wf2.id && sorted[1].displayOrder === 2, "order 2");
  assert(sorted[2].id === wf3.id && sorted[2].displayOrder === 3, "order 3");
  assert(new Set([wf1.id, wf2.id, wf3.id]).size === 3, "distinct ids");
  assert(
    wf1.serviceResourceId === wf2.serviceResourceId &&
      wf2.serviceResourceId === wf3.serviceResourceId,
    "same first service for WF1–3"
  );
  assert(wf3.serviceResourceId, "WF3 service mapping");
  assert(!/agency building/i.test(wf3.name), "no Agency Building");

  const def3 = (await req(`/api/workflows/definitions/${wf3.id}`, { token })).workflow;
  assert(def3.product.slug === PRODUCT_SLUG, "product");
  assert(def3.serviceResource?.title === SERVICE_TITLE, `service=${def3.serviceResource?.title}`);
  assert(/Implementation Playbook/i.test(def3.name), `name=${def3.name}`);
  const keys3 = def3.inputs.map((i: { key: string }) => i.key);
  assert(keys3.includes("approved_system_summary"), "WF3 approved_system_summary");
  assert(keys3.includes("operator_roles"), "WF3 operator_roles");
  assert(!keys3.includes("priority_opportunity"), "WF3 must not use WF2-only priority_opportunity");

  const def1 = (await req(`/api/workflows/definitions/${wf1.id}`, { token })).workflow;
  const def2 = (await req(`/api/workflows/definitions/${wf2.id}`, { token })).workflow;
  assert(
    !def1.inputs.some((i: { key: string }) => i.key === "approved_system_summary"),
    "WF1 unchanged — no WF3-only field"
  );
  assert(
    def2.inputs.some((i: { key: string }) => i.key === "priority_opportunity"),
    "WF2 still has priority_opportunity"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF3 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF3 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep3 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf3.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_TITLE,
        goals: "Roll out approved enablement system with human gates",
        constraints: "No autonomous client contact",
        approved_system_summary: "Enquiry triage prompts + SOP with daily checklist",
        operator_roles: "Front desk lead + practice manager",
        go_live_window: "Next 14 days",
      },
    }),
  });
  assert(prep3.ready, "WF3 prepare ready");
  assert(prep3.context.workflow.id === wf3.id, "prepare WF3 id");
  assert(prep3.context.service?.id === wf3.serviceResourceId, "prepare service id");
  assert(
    /implementation playbook|implementation plan|actionable implementation/i.test(
      prep3.instruction
    ),
    "WF3-specific instruction"
  );
  assert(/approved_system_summary|Enquiry triage|Front desk/i.test(prep3.instruction), "WF3 inputs in prompt");
  assert(!/Agency Building/i.test(prep3.instruction), "no Agency Building");

  const save3 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf3.id,
      projectId: project.id,
      instruction: prep3.instruction,
      output: "## WF3 Implementation Playbook smoke\nSteps 1-5 with approval gates.",
      reviewStatus: "APPROVED",
      title: `${wf3.name} — smoke`,
      inputs: {
        service_focus: SERVICE_TITLE,
        approved_system_summary: "Enquiry triage prompts + SOP",
        operator_roles: "Front desk lead",
      },
    }),
  });
  assert(save3.result.workflowKey === wf3.key, "save WF3 key");
  assert(save3.result.metadata.serviceResourceId === wf3.serviceResourceId, "save service");

  // WF1 regression
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
        goals: "Assess readiness",
      },
    }),
  });
  assert(prep1.ready && /readiness/i.test(prep1.instruction), "WF1 regression prepare");
  assert(prep1.instruction !== prep3.instruction, "WF1 ≠ WF3 prompt");

  // WF2 regression
  const prep2 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf2.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_TITLE,
        goals: "Design enablement system",
        priority_opportunity: "Faster enquiry triage",
      },
    }),
  });
  assert(prep2.ready && /system design|enablement system/i.test(prep2.instruction), "WF2 regression");
  assert(prep2.instruction !== prep3.instruction, "WF2 ≠ WF3 prompt");
  assert(prep1.instruction !== prep2.instruction, "WF1 ≠ WF2 prompt");

  const save1 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      instruction: prep1.instruction,
      output: "## WF1 smoke",
      reviewStatus: "APPROVED",
      title: `${wf1.name} — smoke`,
    }),
  });
  const save2 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf2.id,
      projectId: project.id,
      instruction: prep2.instruction,
      output: "## WF2 smoke",
      reviewStatus: "APPROVED",
      title: `${wf2.name} — smoke`,
    }),
  });

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;

  assert(results.some((r) => r.id === save1.result.id && r.workflowKey === wf1.key), "WF1 restore");
  assert(results.some((r) => r.id === save2.result.id && r.workflowKey === wf2.key), "WF2 restore");
  assert(results.some((r) => r.id === save3.result.id && r.workflowKey === wf3.key), "WF3 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf3.key).some((r) => r.id === save1.result.id),
    "WF1 result not in WF3"
  );

  console.log("PASS — Workflow 3 + WF1/WF2 regression");
  console.log(`  WF3: ${wf3.name}`);
  console.log(`  service: ${SERVICE_TITLE}`);
  console.log(`  workflowId: ${wf3.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
