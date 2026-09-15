/**
 * Smoke: AI Advantage Workflow 6 + WF1–5 regression.
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
const WF6_KEY = "process-and-task-mapping-implementation-playbook";

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
  console.log("Workflow 6 smoke + WF1–5 regression — AI Advantage Agency");

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
  const wf6 = workflows.find((w: { key: string }) => w.key === WF6_KEY);
  assert(wf1 && wf2 && wf3 && wf4 && wf5 && wf6, "WF1–6 keys");
  assert(sorted[0].id === wf1.id && sorted[0].displayOrder === 1, "order1");
  assert(sorted[1].id === wf2.id && sorted[1].displayOrder === 2, "order2");
  assert(sorted[2].id === wf3.id && sorted[2].displayOrder === 3, "order3");
  assert(sorted[3].id === wf4.id && sorted[3].displayOrder === 4, "order4");
  assert(sorted[4].id === wf5.id && sorted[4].displayOrder === 5, "order5");
  assert(sorted[5].id === wf6.id && sorted[5].displayOrder === 6, "order6");
  assert(new Set([wf1.id, wf2.id, wf3.id, wf4.id, wf5.id, wf6.id]).size === 6, "distinct ids");
  assert(wf6.serviceResourceId, "WF6 service mapping");
  assert(wf6.serviceResourceId === wf4.serviceResourceId, "WF6 same service as WF4/5");
  assert(wf6.serviceResourceId !== wf1.serviceResourceId, "WF6 different service from WF1");
  assert(!/agency building/i.test(wf6.name), "no Agency Building");

  const def6 = (await req(`/api/workflows/definitions/${wf6.id}`, { token })).workflow;
  assert(def6.product.slug === PRODUCT_SLUG, "product");
  assert(def6.serviceResource?.title === SERVICE_PROCESS, `service=${def6.serviceResource?.title}`);
  assert(
    /Process and Task Mapping/i.test(def6.name) && /Implementation Playbook/i.test(def6.name),
    def6.name
  );
  const keys6 = def6.inputs.map((i: { key: string }) => i.key);
  assert(
    keys6.includes("approved_process_design") && keys6.includes("rollout_owners_by_step"),
    "WF6-specific inputs"
  );
  assert(!keys6.includes("approved_system_summary"), "WF6 must not use WF3-only approved_system_summary");
  assert(!keys6.includes("operator_roles"), "WF6 must not use WF3-only operator_roles");
  assert(!keys6.includes("process_scope"), "WF6 must not use WF4-only process_scope");
  assert(!keys6.includes("process_selected_for_design"), "WF6 must not use WF5-only fields");
  assert(!keys6.includes("priority_opportunity"), "WF6 must not use WF2-only fields");
  assert(!keys6.includes("current_ai_usage"), "WF6 must not use WF1-only fields");

  const def3 = (await req(`/api/workflows/definitions/${wf3.id}`, { token })).workflow;
  assert(
    def3.inputs.some((i: { key: string }) => i.key === "approved_system_summary"),
    "WF3 still has approved_system_summary"
  );
  assert(
    !def3.inputs.some((i: { key: string }) => i.key === "approved_process_design"),
    "WF3 unchanged — no approved_process_design"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF6 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF6 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep6 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf6.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Roll out the approved enquiry-to-booking process map",
        approved_process_design:
          "Mapped flow: intake → triage (15m SLA) → confirm booking → written follow-up",
        rollout_owners_by_step: "Reception owns intake; Owner owns triage; Admin confirms booking",
        pilot_cutover_window: "Pilot Mon–Wed; full cutover Friday",
      },
    }),
  });
  assert(prep6.ready, "WF6 prepare ready");
  assert(prep6.context.workflow.id === wf6.id, "prepare WF6 id");
  assert(prep6.context.service?.id === wf6.serviceResourceId, "prepare service");
  assert(prep6.context.service?.title === SERVICE_PROCESS, "prepare service title");
  assert(/Process and Task Mapping/i.test(prep6.instruction), "service in prompt");
  assert(/15m SLA|Reception owns|Pilot Mon/i.test(prep6.instruction), "WF6 inputs in prompt");
  assert(/implementation/i.test(prep6.instruction), "implementation purpose");
  assert(!/Agency Building/i.test(prep6.instruction), "no Agency Building");

  const save6 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf6.id,
      projectId: project.id,
      instruction: prep6.instruction,
      output: "## WF6 Process Implementation Playbook smoke\nCutover steps drafted.",
      reviewStatus: "APPROVED",
      title: `${wf6.name} — smoke`,
      inputs: {
        service_focus: SERVICE_PROCESS,
        approved_process_design: "intake → triage → booking",
        rollout_owners_by_step: "Reception / Owner / Admin",
      },
    }),
  });
  assert(save6.result.workflowKey === wf6.key, "save key");
  assert(save6.result.metadata.serviceResourceId === wf6.serviceResourceId, "save service");

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
        goals: "Design process system",
        process_selected_for_design: "Enquiry intake → booking",
        current_step_sequence: "Email → triage → book",
      },
    }),
  });

  assert(prep1.ready && /readiness/i.test(prep1.instruction), "WF1 ok");
  assert(prep2.ready && /system design|enablement system/i.test(prep2.instruction), "WF2 ok");
  assert(prep3.ready && /implementation/i.test(prep3.instruction), "WF3 ok");
  assert(prep3.instruction.includes("Triage SOP"), "WF3 inputs");
  assert(prep4.ready && /Enquiry intake|shared inbox/i.test(prep4.instruction), "WF4 ok");
  assert(prep5.ready && /process_selected|Email → triage/i.test(prep5.instruction), "WF5 ok");
  assert(prep1.instruction !== prep6.instruction, "WF1≠WF6");
  assert(prep2.instruction !== prep6.instruction, "WF2≠WF6");
  assert(prep3.instruction !== prep6.instruction, "WF3≠WF6");
  assert(prep4.instruction !== prep6.instruction, "WF4≠WF6");
  assert(prep5.instruction !== prep6.instruction, "WF5≠WF6");

  const saves = await Promise.all(
    [
      [wf1, prep1, "## WF1"],
      [wf2, prep2, "## WF2"],
      [wf3, prep3, "## WF3"],
      [wf4, prep4, "## WF4"],
      [wf5, prep5, "## WF5"],
    ].map(([wf, prep, output]) =>
      req("/api/workflows/engine/save-result", {
        method: "POST",
        token,
        body: JSON.stringify({
          workflowId: (wf as { id: string; name: string; key: string }).id,
          projectId: project.id,
          instruction: (prep as { instruction: string }).instruction,
          output,
          reviewStatus: "APPROVED",
          title: `${(wf as { name: string }).name} — smoke`,
        }),
      })
    )
  );

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;

  const keys = [wf1, wf2, wf3, wf4, wf5, wf6].map((w) => w.key);
  for (let i = 0; i < 5; i++) {
    assert(
      results.some((r) => r.id === saves[i].result.id && r.workflowKey === keys[i]),
      `WF${i + 1} restore`
    );
  }
  assert(results.some((r) => r.id === save6.result.id && r.workflowKey === wf6.key), "WF6 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf6.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF6"
  );

  console.log("PASS — Workflow 6 + WF1–5 regression");
  console.log(`  WF6: ${wf6.name}`);
  console.log(`  service: ${SERVICE_PROCESS}`);
  console.log(`  workflowId: ${wf6.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
