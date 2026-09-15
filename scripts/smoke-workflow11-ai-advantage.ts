/**
 * Smoke: AI Advantage Workflow 11 + WF1–10 regression.
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
  "prompt-systems-and-workflow-sops-system-design",
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
  console.log("Workflow 11 smoke + WF1–10 regression — AI Advantage Agency");

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
  assert(wfs.every(Boolean), "WF1–11 keys");
  const [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9, wf10, wf11] = wfs;
  for (let i = 0; i < 11; i++) {
    assert(sorted[i].id === wfs[i].id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(new Set(wfs.map((w) => w.id)).size === 11, "distinct ids");
  assert(wf11.serviceResourceId === wf10.serviceResourceId, "WF11 same service as WF10");
  assert(wf11.serviceResourceId !== wf1.serviceResourceId, "WF11 ≠ WF1 service");
  assert(!/agency building/i.test(wf11.name), "no Agency Building");

  const def11 = (await req(`/api/workflows/definitions/${wf11.id}`, { token })).workflow;
  assert(def11.product.slug === PRODUCT_SLUG, "product");
  assert(def11.serviceResource?.title === SERVICE_PROMPTS, `service=${def11.serviceResource?.title}`);
  assert(
    /Prompt Systems and Workflow SOPs/i.test(def11.name) && /System Design/i.test(def11.name),
    def11.name
  );
  const keys11 = def11.inputs.map((i: { key: string }) => i.key);
  assert(
    keys11.includes("priority_prompt_workflows") && keys11.includes("prompt_library_structure"),
    "WF11-specific inputs"
  );
  assert(!keys11.includes("priority_opportunity"), "WF11 must not use WF2-only fields");
  assert(!keys11.includes("existing_tools"), "WF11 must not use WF2-only existing_tools");
  assert(!keys11.includes("prompt_sop_scope"), "WF11 must not use WF10-only prompt_sop_scope");
  assert(!keys11.includes("shortlisted_use_cases"), "WF11 must not use WF8-only fields");
  assert(!keys11.includes("process_selected_for_design"), "WF11 must not use WF5-only fields");

  const def2 = (await req(`/api/workflows/definitions/${wf2.id}`, { token })).workflow;
  assert(
    def2.inputs.some((i: { key: string }) => i.key === "priority_opportunity"),
    "WF2 still has priority_opportunity"
  );
  assert(
    !def2.inputs.some((i: { key: string }) => i.key === "priority_prompt_workflows"),
    "WF2 unchanged — no priority_prompt_workflows"
  );

  const def10 = (await req(`/api/workflows/definitions/${wf10.id}`, { token })).workflow;
  assert(
    def10.inputs.some((i: { key: string }) => i.key === "prompt_sop_scope"),
    "WF10 still has prompt_sop_scope"
  );
  assert(
    !def10.inputs.some((i: { key: string }) => i.key === "priority_prompt_workflows"),
    "WF10 unchanged — no priority_prompt_workflows"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF11 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF11 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep11 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf11.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROMPTS,
        goals: "Design a prompt library and SOP structure for front-desk workflows",
        priority_prompt_workflows: "Enquiry reply drafts; recall reminder drafts",
        prompt_library_structure:
          "By channel → role → task; versioned prompts; required inputs; sample outputs",
        human_approval_gates: "Owner reviews any clinical claim before send",
      },
    }),
  });
  assert(prep11.ready, "WF11 prepare ready");
  assert(prep11.context.workflow.id === wf11.id, "prepare WF11 id");
  assert(prep11.context.service?.id === wf11.serviceResourceId, "prepare service");
  assert(prep11.context.service?.title === SERVICE_PROMPTS, "prepare service title");
  assert(/Prompt Systems|Workflow SOPs/i.test(prep11.instruction), "service in prompt");
  assert(
    /Enquiry reply|versioned prompts|clinical claim/i.test(prep11.instruction),
    "WF11 inputs in prompt"
  );
  assert(/system design|enablement system/i.test(prep11.instruction), "system design purpose");
  assert(!/Agency Building/i.test(prep11.instruction), "no Agency Building");

  const save11 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf11.id,
      projectId: project.id,
      instruction: prep11.instruction,
      output: "## WF11 Prompt SOP System Design smoke\nLibrary blueprint drafted.",
      reviewStatus: "APPROVED",
      title: `${wf11.name} — smoke`,
      inputs: {
        service_focus: SERVICE_PROMPTS,
        priority_prompt_workflows: "Enquiry replies; recall drafts",
        prompt_library_structure: "Channel → role → task",
      },
    }),
  });
  assert(save11.result.workflowKey === wf11.key, "save key");
  assert(save11.result.metadata.serviceResourceId === wf11.serviceResourceId, "save service");

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
    {
      wf: wf10,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROMPTS,
        goals: "Assess prompt SOP readiness",
        prompt_sop_scope: "Enquiry replies; recall drafts",
        existing_prompts_sops: "Ad-hoc ChatGPT only",
      },
      check: (i) => /Enquiry replies|Ad-hoc ChatGPT/i.test(i),
      label: "WF10 ok",
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
    assert(prep.instruction !== prep11.instruction, `${spec.label} ≠ WF11`);
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
    results.some((r) => r.id === save11.result.id && r.workflowKey === wf11.key),
    "WF11 restore"
  );
  assert(
    !results.filter((r) => r.workflowKey === wf11.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF11"
  );

  console.log("PASS — Workflow 11 + WF1–10 regression");
  console.log(`  WF11: ${wf11.name}`);
  console.log(`  service: ${SERVICE_PROMPTS}`);
  console.log(`  workflowId: ${wf11.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
