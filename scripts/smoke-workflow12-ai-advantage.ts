/**
 * Smoke: AI Advantage Workflow 12 + WF1–11 regression.
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
  "prompt-systems-and-workflow-sops-implementation-playbook",
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
  console.log("Workflow 12 smoke + WF1–11 regression — AI Advantage Agency");

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
  assert(wfs.every(Boolean), "WF1–12 keys");
  const [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9, wf10, wf11, wf12] = wfs;
  for (let i = 0; i < 12; i++) {
    assert(sorted[i].id === wfs[i].id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(new Set(wfs.map((w) => w.id)).size === 12, "distinct ids");
  assert(wf12.serviceResourceId === wf10.serviceResourceId, "WF12 same service as WF10/11");
  assert(wf12.serviceResourceId !== wf1.serviceResourceId, "WF12 ≠ WF1 service");
  assert(!/agency building/i.test(wf12.name), "no Agency Building");

  const def12 = (await req(`/api/workflows/definitions/${wf12.id}`, { token })).workflow;
  assert(def12.product.slug === PRODUCT_SLUG, "product");
  assert(def12.serviceResource?.title === SERVICE_PROMPTS, `service=${def12.serviceResource?.title}`);
  assert(
    /Prompt Systems and Workflow SOPs/i.test(def12.name) && /Implementation Playbook/i.test(def12.name),
    def12.name
  );
  const keys12 = def12.inputs.map((i: { key: string }) => i.key);
  assert(
    keys12.includes("approved_prompt_system_design") && keys12.includes("implementation_owners"),
    "WF12-specific inputs"
  );
  assert(!keys12.includes("approved_system_summary"), "WF12 must not use WF3-only fields");
  assert(!keys12.includes("approved_process_design"), "WF12 must not use WF6-only fields");
  assert(!keys12.includes("approved_roadmap_design"), "WF12 must not use WF9-only fields");
  assert(!keys12.includes("prompt_sop_scope"), "WF12 must not use WF10-only fields");
  assert(!keys12.includes("priority_prompt_workflows"), "WF12 must not use WF11-only fields");

  const out = def12.outputDefinition as { deliverableType?: string; sections?: string[] };
  assert(/Prompt.*SOP Implementation Playbook/i.test(out?.deliverableType || ""), "WF12 deliverable");
  assert(
    Array.isArray(out?.sections) && out.sections.includes("Testing Plan") && out.sections.includes("First Actions"),
    "WF12 output sections"
  );
  const review = def12.reviewRequirements as { checklist?: string[] };
  assert(
    Array.isArray(review?.checklist) &&
      review.checklist.some((c) => /approved prompt\/SOP system design/i.test(c)),
    "WF12 review checklist"
  );

  const def3 = (await req(`/api/workflows/definitions/${wf3.id}`, { token })).workflow;
  assert(
    def3.inputs.some((i: { key: string }) => i.key === "approved_system_summary"),
    "WF3 still has approved_system_summary"
  );
  assert(
    !def3.inputs.some((i: { key: string }) => i.key === "approved_prompt_system_design"),
    "WF3 unchanged — no approved_prompt_system_design"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF12 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF12 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep12 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf12.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROMPTS,
        goals: "Implement the approved prompt library and SOP rollout plan",
        approved_prompt_system_design:
          "Library by channel→role→task; enquiry reply + recall drafts; owner clinical-claim gate",
        implementation_owners: "Reception creates drafts; Owner approves; Admin maintains library",
        rollout_and_testing_window: "Build week 1; pilot week 2; review Friday",
      },
    }),
  });
  assert(prep12.ready, "WF12 prepare ready");
  assert(prep12.context.workflow.id === wf12.id, "prepare WF12 id");
  assert(prep12.context.service?.id === wf12.serviceResourceId, "prepare service");
  assert(prep12.context.service?.title === SERVICE_PROMPTS, "prepare service title");
  assert(/Prompt Systems|Workflow SOPs/i.test(prep12.instruction), "service in prompt");
  assert(
    /channel→role→task|Reception creates|pilot week 2/i.test(prep12.instruction),
    "WF12 inputs in prompt"
  );
  assert(/Prompt & SOP Implementation Playbook|implementation playbook/i.test(prep12.instruction), "playbook purpose");
  assert(/Testing Plan|First Actions/i.test(prep12.instruction), "WF12 output sections in prompt");
  assert(!/Agency Building/i.test(prep12.instruction), "no Agency Building");
  assert(!/deploys prompts|autonomous deployment/i.test(prep12.instruction) || /Do NOT/i.test(prep12.instruction), "no deploy claims without prohibition");

  const save12 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf12.id,
      projectId: project.id,
      instruction: prep12.instruction,
      output: "## WF12 Prompt SOP Implementation Playbook smoke\nRollout sequence drafted.",
      reviewStatus: "APPROVED",
      title: `${wf12.name} — smoke`,
      inputs: {
        service_focus: SERVICE_PROMPTS,
        approved_prompt_system_design: "Library + gates",
        implementation_owners: "Reception / Owner / Admin",
      },
    }),
  });
  assert(save12.result.workflowKey === wf12.key, "save key");
  assert(save12.result.metadata.serviceResourceId === wf12.serviceResourceId, "save service");

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
    {
      wf: wf11,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_PROMPTS,
        goals: "Design prompt SOP system",
        priority_prompt_workflows: "Enquiry reply drafts; recall drafts",
        prompt_library_structure: "Channel → role → task",
      },
      check: (i) => /Enquiry reply|Channel → role/i.test(i),
      label: "WF11 ok",
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
    assert(prep.instruction !== prep12.instruction, `${spec.label} ≠ WF12`);
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
    results.some((r) => r.id === save12.result.id && r.workflowKey === wf12.key),
    "WF12 restore"
  );
  assert(
    !results.filter((r) => r.workflowKey === wf12.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF12"
  );

  console.log("PASS — Workflow 12 + WF1–11 regression");
  console.log(`  WF12: ${wf12.name}`);
  console.log(`  service: ${SERVICE_PROMPTS}`);
  console.log(`  key: ${wf12.key}`);
  console.log(`  displayOrder: 12`);
  console.log(`  workflowId: ${wf12.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
