/**
 * Smoke: AI Advantage Workflow 4 + WF1–3 regression.
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
const SERVICE_WF1_3 = "AI Readiness and Opportunity Audit";
const SERVICE_WF4 = "Process and Task Mapping";
const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const WF2_KEY = "ai-readiness-and-opportunity-audit-system-design";
const WF3_KEY = "ai-readiness-and-opportunity-audit-implementation-playbook";
const WF4_KEY = "process-and-task-mapping-readiness-assessment";

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
  console.log("Workflow 4 smoke + WF1–3 regression — AI Advantage Agency");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.tokens?.accessToken || login.token) as string;
  assert(token, "login");

  const product = (await req(`/api/products/${PRODUCT_SLUG}`, { token })).product;
  const { workflows } = await req(`/api/products/${PRODUCT_SLUG}/workflows`, { token });
  assert(workflows.length === 31, `count=${workflows.length}`);

  const sorted = [...workflows].sort(
    (a: { displayOrder: number }, b: { displayOrder: number }) =>
      a.displayOrder - b.displayOrder
  );
  const wf1 = workflows.find((w: { key: string }) => w.key === WF1_KEY);
  const wf2 = workflows.find((w: { key: string }) => w.key === WF2_KEY);
  const wf3 = workflows.find((w: { key: string }) => w.key === WF3_KEY);
  const wf4 = workflows.find((w: { key: string }) => w.key === WF4_KEY);
  assert(wf1 && wf2 && wf3 && wf4, "WF1–4 keys");
  assert(sorted[0].id === wf1.id && sorted[0].displayOrder === 1, "order1");
  assert(sorted[1].id === wf2.id && sorted[1].displayOrder === 2, "order2");
  assert(sorted[2].id === wf3.id && sorted[2].displayOrder === 3, "order3");
  assert(sorted[3].id === wf4.id && sorted[3].displayOrder === 4, "order4");
  assert(new Set([wf1.id, wf2.id, wf3.id, wf4.id]).size === 4, "distinct ids");
  assert(wf4.serviceResourceId, "WF4 service mapping");
  assert(wf4.serviceResourceId !== wf1.serviceResourceId, "WF4 different service from WF1");
  assert(!/agency building/i.test(wf4.name), "no Agency Building");

  const def4 = (await req(`/api/workflows/definitions/${wf4.id}`, { token })).workflow;
  assert(def4.product.slug === PRODUCT_SLUG, "product");
  assert(def4.serviceResource?.title === SERVICE_WF4, `service=${def4.serviceResource?.title}`);
  assert(/Process and Task Mapping/i.test(def4.name) && /Readiness Assessment/i.test(def4.name), def4.name);
  const keys4 = def4.inputs.map((i: { key: string }) => i.key);
  assert(keys4.includes("process_scope") && keys4.includes("known_friction"), "WF4-specific inputs");
  assert(!keys4.includes("current_ai_usage"), "WF4 must not use WF1-only current_ai_usage");
  assert(!keys4.includes("priority_opportunity"), "WF4 must not use WF2-only fields");
  assert(!keys4.includes("approved_system_summary"), "WF4 must not use WF3-only fields");

  const def1 = (await req(`/api/workflows/definitions/${wf1.id}`, { token })).workflow;
  assert(
    def1.inputs.some((i: { key: string }) => i.key === "current_ai_usage"),
    "WF1 still has current_ai_usage"
  );
  assert(
    !def1.inputs.some((i: { key: string }) => i.key === "process_scope"),
    "WF1 unchanged — no process_scope"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF4 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF4 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep4 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf4.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF4,
        goals: "Assess readiness to map enquiry-to-booking tasks",
        process_scope: "Enquiry intake → triage → booking confirmation",
        known_friction: "Handoffs stall in shared inbox; no owner for callbacks",
        systems_of_record: "Gmail + spreadsheet",
      },
    }),
  });
  assert(prep4.ready, "WF4 prepare ready");
  assert(prep4.context.workflow.id === wf4.id, "prepare WF4 id");
  assert(prep4.context.service?.id === wf4.serviceResourceId, "prepare service");
  assert(prep4.context.service?.title === SERVICE_WF4, "prepare service title");
  assert(/Process and Task Mapping/i.test(prep4.instruction), "service in prompt");
  assert(/Enquiry intake|shared inbox|Gmail/i.test(prep4.instruction), "WF4 inputs in prompt");
  assert(/readiness/i.test(prep4.instruction), "readiness purpose");
  assert(!/Agency Building/i.test(prep4.instruction), "no Agency Building");

  const save4 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf4.id,
      projectId: project.id,
      instruction: prep4.instruction,
      output: "## WF4 Process Readiness smoke\nFriction map drafted.",
      reviewStatus: "APPROVED",
      title: `${wf4.name} — smoke`,
      inputs: {
        service_focus: SERVICE_WF4,
        process_scope: "Enquiry intake → booking",
        known_friction: "Shared inbox stalls",
      },
    }),
  });
  assert(save4.result.workflowKey === wf4.key, "save key");
  assert(save4.result.metadata.serviceResourceId === wf4.serviceResourceId, "save service");

  // Regressions
  const prep1 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Assess AI readiness",
      },
    }),
  });
  const prep2 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf2.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Design system",
        priority_opportunity: "Enquiry triage",
      },
    }),
  });
  const prep3 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf3.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Implement playbook",
        approved_system_summary: "Triage SOP",
        operator_roles: "Front desk",
      },
    }),
  });

  assert(prep1.ready && /readiness/i.test(prep1.instruction), "WF1 ok");
  assert(prep2.ready && /system design|enablement system/i.test(prep2.instruction), "WF2 ok");
  assert(prep3.ready && /implementation/i.test(prep3.instruction), "WF3 ok");
  assert(prep1.instruction !== prep4.instruction, "WF1≠WF4");
  assert(prep2.instruction !== prep4.instruction, "WF2≠WF4");
  assert(prep3.instruction !== prep4.instruction, "WF3≠WF4");

  const save1 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf1.id,
      projectId: project.id,
      instruction: prep1.instruction,
      output: "## WF1",
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
      output: "## WF2",
      reviewStatus: "APPROVED",
      title: `${wf2.name} — smoke`,
    }),
  });
  const save3 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf3.id,
      projectId: project.id,
      instruction: prep3.instruction,
      output: "## WF3",
      reviewStatus: "APPROVED",
      title: `${wf3.name} — smoke`,
    }),
  });

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;

  assert(results.some((r) => r.id === save1.result.id && r.workflowKey === wf1.key), "WF1 restore");
  assert(results.some((r) => r.id === save2.result.id && r.workflowKey === wf2.key), "WF2 restore");
  assert(results.some((r) => r.id === save3.result.id && r.workflowKey === wf3.key), "WF3 restore");
  assert(results.some((r) => r.id === save4.result.id && r.workflowKey === wf4.key), "WF4 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf4.key).some((r) => r.id === save1.result.id),
    "WF1 not in WF4"
  );

  console.log("PASS — Workflow 4 + WF1–3 regression");
  console.log(`  WF4: ${wf4.name}`);
  console.log(`  service: ${SERVICE_WF4}`);
  console.log(`  workflowId: ${wf4.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
