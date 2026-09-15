/**
 * Smoke: AI Advantage Workflow 9 + WF1–8 regression.
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
  console.log("Workflow 9 smoke + WF1–8 regression — AI Advantage Agency");

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
  assert(wfs.every(Boolean), "WF1–9 keys");
  const [wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8, wf9] = wfs;
  for (let i = 0; i < 9; i++) {
    assert(sorted[i].id === wfs[i].id && sorted[i].displayOrder === i + 1, `order${i + 1}`);
  }
  assert(new Set(wfs.map((w) => w.id)).size === 9, "distinct ids");
  assert(wf9.serviceResourceId === wf7.serviceResourceId, "WF9 same service as WF7/8");
  assert(wf9.serviceResourceId !== wf1.serviceResourceId, "WF9 ≠ WF1 service");
  assert(wf9.serviceResourceId !== wf4.serviceResourceId, "WF9 ≠ WF4 service");
  assert(!/agency building/i.test(wf9.name), "no Agency Building");

  const def9 = (await req(`/api/workflows/definitions/${wf9.id}`, { token })).workflow;
  assert(def9.product.slug === PRODUCT_SLUG, "product");
  assert(def9.serviceResource?.title === SERVICE_USECASE, `service=${def9.serviceResource?.title}`);
  assert(
    /Use-Case Prioritization/i.test(def9.name) && /Implementation Playbook/i.test(def9.name),
    def9.name
  );
  const keys9 = def9.inputs.map((i: { key: string }) => i.key);
  assert(
    keys9.includes("approved_roadmap_design") && keys9.includes("wave_owners"),
    "WF9-specific inputs"
  );
  assert(!keys9.includes("approved_system_summary"), "WF9 must not use WF3-only fields");
  assert(!keys9.includes("operator_roles"), "WF9 must not use WF3-only operator_roles");
  assert(!keys9.includes("approved_process_design"), "WF9 must not use WF6-only fields");
  assert(!keys9.includes("shortlisted_use_cases"), "WF9 must not use WF8-only fields");
  assert(!keys9.includes("candidate_use_cases"), "WF9 must not use WF7-only fields");

  const def3 = (await req(`/api/workflows/definitions/${wf3.id}`, { token })).workflow;
  assert(
    def3.inputs.some((i: { key: string }) => i.key === "approved_system_summary"),
    "WF3 still has approved_system_summary"
  );
  assert(
    !def3.inputs.some((i: { key: string }) => i.key === "approved_roadmap_design"),
    "WF3 unchanged — no approved_roadmap_design"
  );

  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "WF9 Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  const project = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF9 Smoke — ${Date.now()}`,
        clientId,
        productId: product.id,
      }),
    })
  ).project;

  const prep9 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf9.id,
      projectId: project.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: SERVICE_USECASE,
        goals: "Execute Wave 1 of the approved AI use-case roadmap",
        approved_roadmap_design:
          "Wave 1: enquiry triage drafts; Wave 2: recall reminders; scored Impact/Effort/Risk",
        wave_owners: "Wave 1 Owner + Reception; Wave 2 Admin",
        first_wave_window: "next 30 days",
      },
    }),
  });
  assert(prep9.ready, "WF9 prepare ready");
  assert(prep9.context.workflow.id === wf9.id, "prepare WF9 id");
  assert(prep9.context.service?.id === wf9.serviceResourceId, "prepare service");
  assert(prep9.context.service?.title === SERVICE_USECASE, "prepare service title");
  assert(/Use-Case Prioritization|Roadmap/i.test(prep9.instruction), "service in prompt");
  assert(/Wave 1|enquiry triage|next 30 days/i.test(prep9.instruction), "WF9 inputs in prompt");
  assert(/implementation/i.test(prep9.instruction), "implementation purpose");
  assert(!/Agency Building/i.test(prep9.instruction), "no Agency Building");

  const save9 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf9.id,
      projectId: project.id,
      instruction: prep9.instruction,
      output: "## WF9 Use-Case Roadmap Playbook smoke\nWave 1 steps drafted.",
      reviewStatus: "APPROVED",
      title: `${wf9.name} — smoke`,
      inputs: {
        service_focus: SERVICE_USECASE,
        approved_roadmap_design: "Wave 1 triage; Wave 2 recall",
        wave_owners: "Owner / Reception / Admin",
      },
    }),
  });
  assert(save9.result.workflowKey === wf9.key, "save key");
  assert(save9.result.metadata.serviceResourceId === wf9.serviceResourceId, "save service");

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
    assert(prep.instruction !== prep9.instruction, `${spec.label} ≠ WF9`);
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
  assert(results.some((r) => r.id === save9.result.id && r.workflowKey === wf9.key), "WF9 restore");
  assert(
    !results.filter((r) => r.workflowKey === wf9.key).some((r) => r.id === saves[0].result.id),
    "WF1 not in WF9"
  );

  console.log("PASS — Workflow 9 + WF1–8 regression");
  console.log(`  WF9: ${wf9.name}`);
  console.log(`  service: ${SERVICE_USECASE}`);
  console.log(`  workflowId: ${wf9.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
