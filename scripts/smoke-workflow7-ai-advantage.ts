/**
 * Smoke: AI Advantage Workflow 7 + WF1–6 regression.
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
const SERVICE_USECASE = "AI Use-Case Prioritization and Roadmap";
const WF1_KEY = "ai-readiness-and-opportunity-audit-readiness-assessment";
const WF2_KEY = "ai-readiness-and-opportunity-audit-system-design";
const WF3_KEY = "ai-readiness-and-opportunity-audit-implementation-playbook";
const WF4_KEY = "process-and-task-mapping-readiness-assessment";
const WF5_KEY = "process-and-task-mapping-system-design";
const WF6_KEY = "process-and-task-mapping-implementation-playbook";
const WF7_KEY = "ai-use-case-prioritization-and-roadmap-readiness-assessment";

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
  console.log("Workflow 7 smoke + WF1–6 regression — AI Advantage Agency");

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
  const byKey = (key: string) => workflows.find((w: { key: string }) => w.key === key);
  const wf1 = byKey(WF1_KEY);
  const wf2 = byKey(WF2_KEY);
  const wf3 = byKey(WF3_KEY);
  const wf4 = byKey(WF4_KEY);
  const wf5 = byKey(WF5_KEY);
  const wf6 = byKey(WF6_KEY);
  const wf7 = byKey(WF7_KEY);
  assert(wf1 && wf2 && wf3 && wf4 && wf5 && wf6 && wf7, "WF1–7 keys");
  for (let i = 0; i < 7; i++) {
    const expected = [wf1, wf2, wf3, wf4, wf5, wf6, wf7][i];
    assert(sorted[i].id === expected.id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(
    new Set([wf1.id, wf2.id, wf3.id, wf4.id, wf5.id, wf6.id, wf7.id]).size === 7,
    "distinct ids"
  );
  assert(wf7.serviceResourceId, "WF7 service mapping");
  assert(wf7.serviceResourceId !== wf1.serviceResourceId, "WF7 different service from WF1");
  assert(wf7.serviceResourceId !== wf4.serviceResourceId, "WF7 different service from WF4");
  assert(!/agency building/i.test(wf7.name), "no Agency Building");

  const def7 = (await req(`/api/workflows/definitions/${wf7.id}`, { token })).workflow;
  assert(def7.product.slug === PRODUCT_SLUG, "product");
  assert(def7.serviceResource?.title === SERVICE_USECASE, `service=${def7.serviceResource?.title}`);
  assert(
    /Use-Case Prioritization/i.test(def7.name) && /Readiness Assessment/i.test(def7.name),
    def7.name
  );
  const keys7 = def7.inputs.map((i: { key: string }) => i.key);
  assert(
    keys7.includes("candidate_use_cases") && keys7.includes("prioritization_criteria"),
    "WF7-specific inputs"
  );
  assert(!keys7.includes("current_ai_usage"), "WF7 must not use WF1-only current_ai_usage");
  assert(!keys7.includes("process_scope"), "WF7 must not use WF4-only process_scope");
  assert(!keys7.includes("priority_opportunity"), "WF7 must not use WF2-only fields");
  assert(!keys7.includes("approved_system_summary"), "WF7 must not use WF3-only fields");
  assert(!keys7.includes("process_selected_for_design"), "WF7 must not use WF5-only fields");
  assert(!keys7.includes("approved_process_design"), "WF7 must not use WF6-only fields");

  const def1 = (await req(`/api/workflows/definitions/${wf1.id}`, { token })).workflow;
  assert(
    def1.inputs.some((i: { key: string }) => i.key === "current_ai_usage"),
    "WF1 still has current_ai_usage"
  );
  assert(
    !def1.inputs.some((i: { key: string }) => i.key === "candidate_use_cases"),
    "WF1 unchanged — no candidate_use_cases"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF7 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF7 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep7 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf7.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Assess readiness to prioritize AI use cases into a roadmap",
        candidate_use_cases:
          "Enquiry triage draft replies; treatment plan summaries; recall reminder drafts",
        prioritization_criteria: "Speed-to-value, clinical risk, staff effort",
        stakeholder_capacity: "Owner + receptionist; limited change bandwidth this quarter",
      },
    }),
  });
  assert(prep7.ready, "WF7 prepare ready");
  assert(prep7.context.workflow.id === wf7.id, "prepare WF7 id");
  assert(prep7.context.service?.id === wf7.serviceResourceId, "prepare service");
  assert(prep7.context.service?.title === SERVICE_USECASE, "prepare service title");
  assert(/Use-Case Prioritization|Roadmap/i.test(prep7.instruction), "service in prompt");
  assert(/Enquiry triage|Speed-to-value|receptionist/i.test(prep7.instruction), "WF7 inputs in prompt");
  assert(/readiness/i.test(prep7.instruction), "readiness purpose");
  assert(!/Agency Building/i.test(prep7.instruction), "no Agency Building");

  const save7 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf7.id,
      projectId: project.id,
      instruction: prep7.instruction,
      output: "## WF7 Use-Case Readiness smoke\nCandidate shortlist scored.",
      reviewStatus: "APPROVED",
      title: `${wf7.name} — smoke`,
      inputs: {
        service_focus: SERVICE_USECASE,
        candidate_use_cases: "Enquiry triage; recall drafts",
        prioritization_criteria: "Speed-to-value, risk",
      },
    }),
  });
  assert(save7.result.workflowKey === wf7.key, "save key");
  assert(save7.result.metadata.serviceResourceId === wf7.serviceResourceId, "save service");

  const prepSpecs: Array<{
    wf: { id: string; name: string; key: string };
    inputs: Record<string, string>;
    check: (instruction: string) => boolean;
    label: string;
  }> = [
    {
      wf: wf1,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Assess AI readiness",
      },
      check: (i) => /readiness/i.test(i),
      label: "WF1 ok",
    },
    {
      wf: wf2,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Design system",
        priority_opportunity: "Enquiry triage",
      },
      check: (i) => /system design|enablement system/i.test(i) && i.includes("Enquiry triage"),
      label: "WF2 ok",
    },
    {
      wf: wf3,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_WF1_3,
        goals: "Implement playbook",
        approved_system_summary: "Triage SOP",
        operator_roles: "Front desk",
      },
      check: (i) => /implementation/i.test(i) && i.includes("Triage SOP"),
      label: "WF3 ok",
    },
    {
      wf: wf4,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Assess process readiness",
        process_scope: "Enquiry intake → booking",
        known_friction: "Shared inbox stalls",
      },
      check: (i) => /Enquiry intake|shared inbox/i.test(i),
      label: "WF4 ok",
    },
    {
      wf: wf5,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Design process system",
        process_selected_for_design: "Enquiry intake → booking",
        current_step_sequence: "Email → triage → book",
      },
      check: (i) => /Email → triage|process_selected|Enquiry intake/i.test(i),
      label: "WF5 ok",
    },
    {
      wf: wf6,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROCESS,
        goals: "Implement process playbook",
        approved_process_design: "intake → triage → booking",
        rollout_owners_by_step: "Reception / Owner",
      },
      check: (i) => /implementation/i.test(i) && /intake → triage|Reception/i.test(i),
      label: "WF6 ok",
    },
  ];

  const preps: Array<{ instruction: string }> = [];
  for (const spec of prepSpecs) {
    const prep = await req("/api/workflows/engine/prepare", {
      method: "POST",
      token,
      body: JSON.stringify({
        workflowId: spec.wf.id,
        projectId: project.id,
        clientId,
        inputs: spec.inputs,
      }),
    });
    assert(prep.ready && spec.check(prep.instruction), spec.label);
    assert(prep.instruction !== prep7.instruction, `${spec.label} ≠ WF7`);
    preps.push(prep);
  }

  const saves = [];
  for (let i = 0; i < prepSpecs.length; i++) {
    const save = await req("/api/workflows/engine/save-result", {
      method: "POST",
      token,
      body: JSON.stringify({
        workflowId: prepSpecs[i].wf.id,
        projectId: project.id,
        instruction: preps[i].instruction,
        output: `## WF${i + 1}`,
        reviewStatus: "APPROVED",
        title: `${prepSpecs[i].wf.name} — smoke`,
      }),
    });
    saves.push(save);
  }

  const results = (
    await req(`/api/workflows/results?projectId=${project.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;

  for (let i = 0; i < prepSpecs.length; i++) {
    assert(
      results.some((r) => r.id === saves[i].result.id && r.workflowKey === prepSpecs[i].wf.key),
      `WF${i + 1} restore`
    );
  }
  assert(results.some((r) => r.id === save7.result.id && r.workflowKey === wf7.key), "WF7 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf7.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF7"
  );

  console.log("PASS — Workflow 7 + WF1–6 regression");
  console.log(`  WF7: ${wf7.name}`);
  console.log(`  service: ${SERVICE_USECASE}`);
  console.log(`  workflowId: ${wf7.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
