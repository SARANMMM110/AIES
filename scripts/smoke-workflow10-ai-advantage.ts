/**
 * Smoke: AI Advantage Workflow 10 + WF1–9 regression.
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
const SERVICE_PROMPTS = "Prompt Systems and Workflow SOPs";

const WF_KEYS = [
  "ai-readiness-and-opportunity-audit-readiness-assessment",
  "ai-readiness-and-opportunity-audit-system-design",
  "ai-readiness-and-opportunity-audit-implementation-playbook",
  "process-and-task-mapping-readiness-assessment",
  "process-and-task-mapping-system-design",
  "process-and-task-mapping-implementation-playbook",
  "ai-use-case-prioritization-and-roadmap-readiness-assessment",
  "ai-use-case-prioritization-and-roadmap-system-design",
  "ai-use-case-prioritization-and-roadmap-implementation-playbook",
  "prompt-systems-and-workflow-sops-readiness-assessment",
] as const;

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

type Wf = { id: string; key: string; name: string; serviceResourceId: string };

async function main() {
  console.log("Workflow 10 smoke + WF1–9 regression — AI Advantage Agency");

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
  const byKey = (key: string) => workflows.find((w: { key: string }) => w.key === key) as Wf;
  const wfs = WF_KEYS.map(byKey);
  assert(wfs.every(Boolean), "WF1–10 keys");
  const [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9, wf10] = wfs;
  for (let i = 0; i < 10; i++) {
    assert(sorted[i].id === wfs[i].id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(new Set(wfs.map((w) => w.id)).size === 10, "distinct ids");
  assert(wf10.serviceResourceId, "WF10 service mapping");
  assert(wf10.serviceResourceId !== wf1.serviceResourceId, "WF10 ≠ WF1 service");
  assert(wf10.serviceResourceId !== wf4.serviceResourceId, "WF10 ≠ WF4 service");
  assert(wf10.serviceResourceId !== wf7.serviceResourceId, "WF10 ≠ WF7 service");
  assert(!/agency building/i.test(wf10.name), "no Agency Building");

  const def10 = (await req(`/api/workflows/definitions/${wf10.id}`, { token })).workflow;
  assert(def10.product.slug === PRODUCT_SLUG, "product");
  assert(def10.serviceResource?.title === SERVICE_PROMPTS, `service=${def10.serviceResource?.title}`);
  assert(
    /Prompt Systems and Workflow SOPs/i.test(def10.name) && /Readiness Assessment/i.test(def10.name),
    def10.name
  );
  const keys10 = def10.inputs.map((i: { key: string }) => i.key);
  assert(
    keys10.includes("prompt_sop_scope") && keys10.includes("existing_prompts_sops"),
    "WF10-specific inputs"
  );
  assert(!keys10.includes("current_ai_usage"), "WF10 must not use WF1-only current_ai_usage");
  assert(!keys10.includes("process_scope"), "WF10 must not use WF4-only process_scope");
  assert(!keys10.includes("candidate_use_cases"), "WF10 must not use WF7-only fields");
  assert(!keys10.includes("shortlisted_use_cases"), "WF10 must not use WF8-only fields");
  assert(!keys10.includes("approved_roadmap_design"), "WF10 must not use WF9-only fields");

  const def1 = (await req(`/api/workflows/definitions/${wf1.id}`, { token })).workflow;
  assert(
    def1.inputs.some((i: { key: string }) => i.key === "current_ai_usage"),
    "WF1 still has current_ai_usage"
  );
  assert(
    !def1.inputs.some((i: { key: string }) => i.key === "prompt_sop_scope"),
    "WF1 unchanged — no prompt_sop_scope"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF10 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF10 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep10 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf10.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROMPTS,
        goals: "Assess readiness to install prompt systems and SOPs",
        prompt_sop_scope: "Front-desk enquiry replies and recall reminder drafts",
        existing_prompts_sops: "One ChatGPT chat; no written SOP library",
        quality_risk_gaps: "Tone drifts; clinical claims sometimes overstated",
      },
    }),
  });
  assert(prep10.ready, "WF10 prepare ready");
  assert(prep10.context.workflow.id === wf10.id, "prepare WF10 id");
  assert(prep10.context.service?.id === wf10.serviceResourceId, "prepare service");
  assert(prep10.context.service?.title === SERVICE_PROMPTS, "prepare service title");
  assert(/Prompt Systems|Workflow SOPs/i.test(prep10.instruction), "service in prompt");
  assert(/Front-desk|ChatGPT chat|Tone drifts/i.test(prep10.instruction), "WF10 inputs in prompt");
  assert(/readiness/i.test(prep10.instruction), "readiness purpose");
  assert(!/Agency Building/i.test(prep10.instruction), "no Agency Building");

  const save10 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf10.id,
      projectId: project.id,
      instruction: prep10.instruction,
      output: "## WF10 Prompt SOP Readiness smoke\nGaps and priorities listed.",
      reviewStatus: "APPROVED",
      title: `${wf10.name} — smoke`,
      inputs: {
        service_focus: SERVICE_PROMPTS,
        prompt_sop_scope: "Enquiry replies; recall drafts",
        existing_prompts_sops: "Ad-hoc ChatGPT only",
      },
    }),
  });
  assert(save10.result.workflowKey === wf10.key, "save key");
  assert(save10.result.metadata.serviceResourceId === wf10.serviceResourceId, "save service");

  const prepSpecs: Array<{
    wf: Wf;
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
    {
      wf: wf8,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Design roadmap system",
        shortlisted_use_cases: "Enquiry triage drafts; recall drafts",
        scoring_model: "Impact 40%, effort 30%, risk 30%",
      },
      check: (i) => /Enquiry triage|Impact 40%/i.test(i),
      label: "WF8 ok",
    },
    {
      wf: wf9,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Implement roadmap playbook",
        approved_roadmap_design: "Wave 1 triage; Wave 2 recall",
        wave_owners: "Owner / Reception",
      },
      check: (i) => /implementation/i.test(i) && /Wave 1|Owner/i.test(i),
      label: "WF9 ok",
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
    assert(prep.instruction !== prep10.instruction, `${spec.label} ≠ WF10`);
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
  assert(
    results.some((r) => r.id === save10.result.id && r.workflowKey === wf10.key),
    "WF10 restore"
  );
  assert(
    !results.filter((r) => r.workflowKey === wf10.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF10"
  );

  console.log("PASS — Workflow 10 + WF1–9 regression");
  console.log(`  WF10: ${wf10.name}`);
  console.log(`  service: ${SERVICE_PROMPTS}`);
  console.log(`  workflowId: ${wf10.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
