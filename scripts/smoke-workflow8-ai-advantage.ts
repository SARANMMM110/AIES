/**
 * Smoke: AI Advantage Workflow 8 + WF1–7 regression.
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
const WF8_KEY = "ai-use-case-prioritization-and-roadmap-system-design";

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
  console.log("Workflow 8 smoke + WF1–7 regression — AI Advantage Agency");

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
  const wfs = [WF1_KEY, WF2_KEY, WF3_KEY, WF4_KEY, WF5_KEY, WF6_KEY, WF7_KEY, WF8_KEY].map(byKey);
  assert(wfs.every(Boolean), "WF1–8 keys");
  const [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8] = wfs as Array<{
    id: string;
    key: string;
    name: string;
    serviceResourceId: string;
    displayOrder: number;
  }>;
  for (let i = 0; i < 8; i++) {
    assert(sorted[i].id === wfs[i]!.id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(new Set(wfs.map((w) => w!.id)).size === 8, "distinct ids");
  assert(wf8.serviceResourceId === wf7.serviceResourceId, "WF8 same service as WF7");
  assert(wf8.serviceResourceId !== wf1.serviceResourceId, "WF8 ≠ WF1 service");
  assert(wf8.serviceResourceId !== wf4.serviceResourceId, "WF8 ≠ WF4 service");
  assert(!/agency building/i.test(wf8.name), "no Agency Building");

  const def8 = (await req(`/api/workflows/definitions/${wf8.id}`, { token })).workflow;
  assert(def8.product.slug === PRODUCT_SLUG, "product");
  assert(def8.serviceResource?.title === SERVICE_USECASE, `service=${def8.serviceResource?.title}`);
  assert(/Use-Case Prioritization/i.test(def8.name) && /System Design/i.test(def8.name), def8.name);
  const keys8 = def8.inputs.map((i: { key: string }) => i.key);
  assert(
    keys8.includes("shortlisted_use_cases") && keys8.includes("scoring_model"),
    "WF8-specific inputs"
  );
  assert(!keys8.includes("priority_opportunity"), "WF8 must not use WF2-only fields");
  assert(!keys8.includes("existing_tools"), "WF8 must not use WF2-only existing_tools");
  assert(!keys8.includes("candidate_use_cases"), "WF8 must not use WF7-only candidate_use_cases");
  assert(!keys8.includes("process_selected_for_design"), "WF8 must not use WF5-only fields");
  assert(!keys8.includes("current_ai_usage"), "WF8 must not use WF1-only fields");

  const def2 = (await req(`/api/workflows/definitions/${wf2.id}`, { token })).workflow;
  assert(
    def2.inputs.some((i: { key: string }) => i.key === "priority_opportunity"),
    "WF2 still has priority_opportunity"
  );
  assert(
    !def2.inputs.some((i: { key: string }) => i.key === "shortlisted_use_cases"),
    "WF2 unchanged — no shortlisted_use_cases"
  );

  const def7 = (await req(`/api/workflows/definitions/${wf7.id}`, { token })).workflow;
  assert(
    def7.inputs.some((i: { key: string }) => i.key === "candidate_use_cases"),
    "WF7 still has candidate_use_cases"
  );
  assert(
    !def7.inputs.some((i: { key: string }) => i.key === "shortlisted_use_cases"),
    "WF7 unchanged — no shortlisted_use_cases"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF8 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF8 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep8 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf8.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Design a scored roadmap for shortlisted AI use cases",
        shortlisted_use_cases: "Enquiry triage drafts; recall reminder drafts",
        scoring_model: "Impact 40%, effort 30%, clinical risk 20%, readiness 10%",
        roadmap_horizon: "90 days",
      },
    }),
  });
  assert(prep8.ready, "WF8 prepare ready");
  assert(prep8.context.workflow.id === wf8.id, "prepare WF8 id");
  assert(prep8.context.service?.id === wf8.serviceResourceId, "prepare service");
  assert(prep8.context.service?.title === SERVICE_USECASE, "prepare service title");
  assert(/Use-Case Prioritization|Roadmap/i.test(prep8.instruction), "service in prompt");
  assert(/Enquiry triage|Impact 40%|90 days/i.test(prep8.instruction), "WF8 inputs in prompt");
  assert(/system design|enablement system/i.test(prep8.instruction), "system design purpose");
  assert(!/Agency Building/i.test(prep8.instruction), "no Agency Building");

  const save8 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf8.id,
      projectId: project.id,
      instruction: prep8.instruction,
      output: "## WF8 Use-Case Roadmap Design smoke\nScored sequence drafted.",
      reviewStatus: "APPROVED",
      title: `${wf8.name} — smoke`,
      inputs: {
        service_focus: SERVICE_USECASE,
        shortlisted_use_cases: "Enquiry triage; recall drafts",
        scoring_model: "Impact/effort/risk",
      },
    }),
  });
  assert(save8.result.workflowKey === wf8.key, "save key");
  assert(save8.result.metadata.serviceResourceId === wf8.serviceResourceId, "save service");

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
      check: (i) => /Email → triage|Enquiry intake/i.test(i),
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
    {
      wf: wf7,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Assess use-case readiness",
        candidate_use_cases: "Enquiry triage; recall drafts",
        prioritization_criteria: "Speed-to-value, risk",
      },
      check: (i) => /Enquiry triage|Speed-to-value/i.test(i),
      label: "WF7 ok",
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
    assert(prep.instruction !== prep8.instruction, `${spec.label} ≠ WF8`);
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
  assert(results.some((r) => r.id === save8.result.id && r.workflowKey === wf8.key), "WF8 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf8.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF8"
  );

  console.log("PASS — Workflow 8 + WF1–7 regression");
  console.log(`  WF8: ${wf8.name}`);
  console.log(`  service: ${SERVICE_USECASE}`);
  console.log(`  workflowId: ${wf8.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
