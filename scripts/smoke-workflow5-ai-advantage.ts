/**
 * Smoke: AI Advantage Workflow 5 + WF1–4 regression.
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
const SERVICE_PROCESS = "Process and Task Mapping";
const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const WF2_KEY = "ai-readiness-and-opportunity-audit-system-design";
const WF3_KEY = "ai-readiness-and-opportunity-audit-implementation-playbook";
const WF4_KEY = "process-and-task-mapping-readiness-assessment";
const WF5_KEY = "process-and-task-mapping-system-design";

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
  console.log("Workflow 5 smoke + WF1–4 regression — AI Advantage Agency");

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
  const wf5 = workflows.find((w: { key: string }) => w.key === WF5_KEY);
  assert(wf1 && wf2 && wf3 && wf4 && wf5, "WF1–5 keys");
  assert(sorted[0].id === wf1.id && sorted[0].displayOrder === 1, "order1");
  assert(sorted[1].id === wf2.id && sorted[1].displayOrder === 2, "order2");
  assert(sorted[2].id === wf3.id && sorted[2].displayOrder === 3, "order3");
  assert(sorted[3].id === wf4.id && sorted[3].displayOrder === 4, "order4");
  assert(sorted[4].id === wf5.id && sorted[4].displayOrder === 5, "order5");
  assert(new Set([wf1.id, wf2.id, wf3.id, wf4.id, wf5.id]).size === 5, "distinct ids");
  assert(wf5.serviceResourceId, "WF5 service mapping");
  assert(wf5.serviceResourceId === wf4.serviceResourceId, "WF5 same service as WF4");
  assert(wf5.serviceResourceId !== wf1.serviceResourceId, "WF5 different service from WF1");
  assert(!/agency building/i.test(wf5.name), "no Agency Building");

  const def5 = (await req(`/api/workflows/definitions/${wf5.id}`, { token })).workflow;
  assert(def5.product.slug === PRODUCT_SLUG, "product");
  assert(def5.serviceResource?.title === SERVICE_PROCESS, `service=${def5.serviceResource?.title}`);
  assert(
    /Process and Task Mapping/i.test(def5.name) && /System Design/i.test(def5.name),
    def5.name
  );
  const keys5 = def5.inputs.map((i: { key: string }) => i.key);
  assert(
    keys5.includes("process_selected_for_design") && keys5.includes("current_step_sequence"),
    "WF5-specific inputs"
  );
  assert(!keys5.includes("priority_opportunity"), "WF5 must not use WF2-only priority_opportunity");
  assert(!keys5.includes("existing_tools"), "WF5 must not use WF2-only existing_tools");
  assert(!keys5.includes("process_scope"), "WF5 must not use WF4-only process_scope");
  assert(!keys5.includes("current_ai_usage"), "WF5 must not use WF1-only current_ai_usage");
  assert(!keys5.includes("approved_system_summary"), "WF5 must not use WF3-only fields");

  const def2 = (await req(`/api/workflows/definitions/${wf2.id}`, { token })).workflow;
  assert(
    def2.inputs.some((i: { key: string }) => i.key === "priority_opportunity"),
    "WF2 still has priority_opportunity"
  );
  assert(
    !def2.inputs.some((i: { key: string }) => i.key === "process_selected_for_design"),
    "WF2 unchanged — no process_selected_for_design"
  );

  const def4 = (await req(`/api/workflows/definitions/${wf4.id}`, { token })).workflow;
  assert(
    def4.inputs.some((i: { key: string }) => i.key === "process_scope"),
    "WF4 still has process_scope"
  );
  assert(
    !def4.inputs.some((i: { key: string }) => i.key === "process_selected_for_design"),
    "WF4 unchanged — no process_selected_for_design"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF5 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF5 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep5 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf5.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Design the enquiry-to-booking process map as an operating system",
        process_selected_for_design: "Enquiry intake → triage → booking confirmation",
        current_step_sequence:
          "1 Reception opens email 2 Owner decides priority 3 Call back 4 Book in calendar",
        target_handoff_rules: "Owner within 15 min; written confirmation required",
      },
    }),
  });
  assert(prep5.ready, "WF5 prepare ready");
  assert(prep5.context.workflow.id === wf5.id, "prepare WF5 id");
  assert(prep5.context.service?.id === wf5.serviceResourceId, "prepare service");
  assert(prep5.context.service?.title === SERVICE_PROCESS, "prepare service title");
  assert(/Process and Task Mapping/i.test(prep5.instruction), "service in prompt");
  assert(
    /Enquiry intake|Reception opens|15 min/i.test(prep5.instruction),
    "WF5 inputs in prompt"
  );
  assert(/system design|enablement system/i.test(prep5.instruction), "system design purpose");
  assert(!/Agency Building/i.test(prep5.instruction), "no Agency Building");

  const save5 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf5.id,
      projectId: project.id,
      instruction: prep5.instruction,
      output: "## WF5 Process System Design smoke\nMapped roles and checkpoints.",
      reviewStatus: "APPROVED",
      title: `${wf5.name} — smoke`,
      inputs: {
        service_focus: SERVICE_PROCESS,
        process_selected_for_design: "Enquiry intake → booking",
        current_step_sequence: "Email → triage → book",
      },
    }),
  });
  assert(save5.result.workflowKey === wf5.key, "save key");
  assert(save5.result.metadata.serviceResourceId === wf5.serviceResourceId, "save service");

  // Regressions WF1–4
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
  const prep4 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf4.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Assess process readiness",
        process_scope: "Enquiry intake → booking",
        known_friction: "Shared inbox stalls",
      },
    }),
  });

  assert(prep1.ready && /readiness/i.test(prep1.instruction), "WF1 ok");
  assert(prep2.ready && /system design|enablement system/i.test(prep2.instruction), "WF2 ok");
  assert(prep2.instruction.includes("Enquiry triage"), "WF2 inputs");
  assert(prep3.ready && /implementation/i.test(prep3.instruction), "WF3 ok");
  assert(prep4.ready && /process_scope|Enquiry intake|shared inbox/i.test(prep4.instruction), "WF4 ok");
  assert(prep1.instruction !== prep5.instruction, "WF1≠WF5");
  assert(prep2.instruction !== prep5.instruction, "WF2≠WF5");
  assert(prep3.instruction !== prep5.instruction, "WF3≠WF5");
  assert(prep4.instruction !== prep5.instruction, "WF4≠WF5");

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
  const save4 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf4.id,
      projectId: project.id,
      instruction: prep4.instruction,
      output: "## WF4",
      reviewStatus: "APPROVED",
      title: `${wf4.name} — smoke`,
    }),
  });

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;

  assert(results.some((r) => r.id === save1.result.id && r.workflowKey === wf1.key), "WF1 restore");
  assert(results.some((r) => r.id === save2.result.id && r.workflowKey === wf2.key), "WF2 restore");
  assert(results.some((r) => r.id === save3.result.id && r.workflowKey === wf3.key), "WF3 restore");
  assert(results.some((r) => r.id === save4.result.id && r.workflowKey === wf4.key), "WF4 restore");
  assert(results.some((r) => r.id === save5.result.id && r.workflowKey === wf5.key), "WF5 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf5.key).some((r) => r.id === save1.result.id),
    "WF1 not in WF5"
  );

  console.log("PASS — Workflow 5 + WF1–4 regression");
  console.log(`  WF5: ${wf5.name}`);
  console.log(`  service: ${SERVICE_PROCESS}`);
  console.log(`  workflowId: ${wf5.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
