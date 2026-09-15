/**
 * Full catalog smoke: WF13–306 specialization + WF1–12 regression.
 * Requires API :4000 and seeded DB.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../apps/api/.env") });

const API = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@aies.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Admin123!ChangeMe";

const EXPECTED: Record<string, number> = {
  "ai-advantage-agency": 31,
  "booking-flow-agency": 31,
  "demand-builder-agency": 31,
  "local-alliance-agency": 31,
  "local-presence-agency": 30,
  "referral-loop-agency": 31,
  "repeat-revenue-agency": 31,
  "revenue-revival-agency": 29,
  "trust-builder-agency": 30,
  "video-authority-agency": 31,
};

const COMMON_KEYS = new Set([
  "client_context",
  "service_focus",
  "goals",
  "constraints",
  "additional_notes",
]);

const WF1_12 = [
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

type Wf = {
  id: string;
  key: string;
  name: string;
  displayOrder: number;
  serviceResourceId: string;
  purpose?: string;
};

async function main() {
  console.log("Full catalog smoke — WF13–306 specialization + WF1–12 regression");

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = (login.tokens?.accessToken || login.token) as string;
  assert(token, "login");

  const products = (await req("/api/products", { token })).products as Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  const published = products.filter((p) => EXPECTED[p.slug] != null);
  assert(published.length === 10, `products=${published.length}`);

  let total = 0;
  const allKeys = new Set<string>();
  const allIds = new Set<string>();
  const samples: Array<{ product: (typeof published)[0]; wf: Wf; def: any }> = [];

  for (const product of published) {
    const { workflows } = await req(`/api/products/${product.slug}/workflows`, { token });
    const expected = EXPECTED[product.slug];
    assert(workflows.length === expected, `${product.slug} count=${workflows.length} expected=${expected}`);
    total += workflows.length;

    const sorted = [...workflows].sort(
      (a: Wf, b: Wf) => a.displayOrder - b.displayOrder
    ) as Wf[];
    for (let i = 0; i < sorted.length; i++) {
      assert(sorted[i].displayOrder === i + 1, `${product.slug} order ${i + 1}`);
      assert(sorted[i].serviceResourceId, `${product.slug} ${sorted[i].key} service mapping`);
      assert(!/agency building/i.test(sorted[i].name), `${sorted[i].key} Agency Building`);
      assert(!allKeys.has(sorted[i].key), `duplicate key ${sorted[i].key}`);
      assert(!allIds.has(sorted[i].id), `duplicate id ${sorted[i].id}`);
      allKeys.add(sorted[i].key);
      allIds.add(sorted[i].id);
    }

    // Spot-check first, middle, last definitions for specialization
    const picks = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
    for (const wf of picks) {
      const def = (await req(`/api/workflows/definitions/${wf.id}`, { token })).workflow;
      assert(def.product.slug === product.slug, `${wf.key} product`);
      assert(def.serviceResource?.title, `${wf.key} service title`);
      assert(Array.isArray(def.inputs) && def.inputs.length >= 5, `${wf.key} inputs`);
      const keys = def.inputs.map((i: { key: string }) => i.key);
      const specific = keys.filter((k: string) => !COMMON_KEYS.has(k));
      assert(specific.length >= 1, `${wf.key} must have phase/service-specific inputs (got ${keys.join(",")})`);
      assert(def.outputDefinition?.sections?.length > 0, `${wf.key} output sections`);
      assert(def.reviewRequirements?.checklist?.length > 0, `${wf.key} review checklist`);
      assert(!/Agency Building/i.test(JSON.stringify(def)), `${wf.key} no Agency Building in def`);
      samples.push({ product, wf, def });
    }
  }

  assert(total === 306, `total workflows=${total}`);
  assert(allKeys.size === 306, `unique keys=${allKeys.size}`);
  assert(allIds.size === 306, `unique ids=${allIds.size}`);

  // AI Advantage WF13–31 specialization
  const aa = published.find((p) => p.slug === "ai-advantage-agency")!;
  const { workflows: aaWfs } = await req(`/api/products/${aa.slug}/workflows`, { token });
  const aaSorted = [...aaWfs].sort((a: Wf, b: Wf) => a.displayOrder - b.displayOrder) as Wf[];
  assert(aaSorted[12].key.includes("marketing-and-content"), "WF13 marketing");
  assert(aaSorted[30].key.includes("continuity-review"), "WF31 continuity");

  const wf13 = (await req(`/api/workflows/definitions/${aaSorted[12].id}`, { token })).workflow;
  assert(
    wf13.inputs.some((i: { key: string }) => i.key === "content_workflow_scope"),
    "WF13 content_workflow_scope"
  );
  assert(
    !wf13.inputs.some((i: { key: string }) => i.key === "current_ai_usage"),
    "WF13 not generic current_ai_usage"
  );

  const wf16 = (await req(`/api/workflows/definitions/${aaSorted[15].id}`, { token })).workflow;
  assert(
    wf16.inputs.some((i: { key: string }) => i.key === "communication_scope"),
    "WF16 communication_scope"
  );

  // Booking Flow sample — process-audit inputs
  const bf = published.find((p) => p.slug === "booking-flow-agency")!;
  const { workflows: bfWfs } = await req(`/api/products/${bf.slug}/workflows`, { token });
  const bf1 = [...bfWfs].sort((a: Wf, b: Wf) => a.displayOrder - b.displayOrder)[0] as Wf;
  const bfDef = (await req(`/api/workflows/definitions/${bf1.id}`, { token })).workflow;
  assert(
    bfDef.inputs.some((i: { key: string }) => i.key === "lead_process_scope"),
    "Booking WF1 lead_process_scope"
  );

  // Clients / project for prepare+save
  const clients = (await req("/api/clients", { token })).clients as Array<{ id: string }>;
  let clientId = clients[0]?.id;
  if (!clientId) {
    const created = await req("/api/clients", {
      method: "POST",
      token,
      body: JSON.stringify({ name: "Full Catalog Smoke Client", industry: "Services" }),
    });
    clientId = created.client.id;
  }

  // Prepare+save one workflow per product (independent keys)
  for (const product of published) {
    const { workflows } = await req(`/api/products/${product.slug}/workflows`, { token });
    const sorted = [...workflows].sort((a: Wf, b: Wf) => a.displayOrder - b.displayOrder) as Wf[];
    const wf = sorted[0];
    const def = (await req(`/api/workflows/definitions/${wf.id}`, { token })).workflow;
    const project = (
      await req("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: `Catalog smoke ${product.slug} — ${Date.now()}`,
          clientId,
          productId: product.id,
        }),
      })
    ).project;

    const inputs: Record<string, string> = {
      client_context: "Business: Smoke Test Co",
      service_focus: def.serviceResource?.title || "Service",
      goals: `Produce ${def.outputDefinition?.deliverableType || "deliverable"} for smoke`,
    };
    for (const f of def.inputs as Array<{ key: string; required?: boolean }>) {
      if (COMMON_KEYS.has(f.key)) continue;
      if (f.required) inputs[f.key] = `Smoke value for ${f.key}`;
    }

    const prep = await req("/api/workflows/engine/prepare", {
      method: "POST",
      token,
      body: JSON.stringify({
        workflowId: wf.id,
        projectId: project.id,
        clientId,
        inputs,
      }),
    });
    assert(prep.ready, `${product.slug} prepare ready`);
    assert(prep.context.workflow.id === wf.id, `${product.slug} prepare id`);
    assert(prep.context.service?.id === wf.serviceResourceId, `${product.slug} prepare service`);
    assert(/Smoke Test Co|Smoke value/i.test(prep.instruction), `${product.slug} inputs in prompt`);
    assert(!/Agency Building/i.test(prep.instruction), `${product.slug} no Agency Building`);
    assert(
      /Do NOT instruct autonomous|autonomous/i.test(prep.instruction),
      `${product.slug} no-fake-automation guidance`
    );

    const save = await req("/api/workflows/engine/save-result", {
      method: "POST",
      token,
      body: JSON.stringify({
        workflowId: wf.id,
        projectId: project.id,
        instruction: prep.instruction,
        output: `## ${wf.name}\nSmoke result`,
        reviewStatus: "APPROVED",
        title: `${wf.name} — catalog smoke`,
        inputs,
      }),
    });
    assert(save.result.workflowKey === wf.key, `${product.slug} save key`);
    assert(save.result.metadata.serviceResourceId === wf.serviceResourceId, `${product.slug} save service`);

    const results = (
      await req(`/api/workflows/results?projectId=${project.id}`, { token })
    ).results as Array<{ id: string; workflowKey: string }>;
    assert(
      results.some((r) => r.id === save.result.id && r.workflowKey === wf.key),
      `${product.slug} restore`
    );
  }

  // WF1–12 regression on AI Advantage
  const aaProduct = (await req(`/api/products/ai-advantage-agency`, { token })).product;
  const { workflows: aaAll } = await req(`/api/products/ai-advantage-agency/workflows`, { token });
  const projectAa = (
    await req("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: `WF1-12 regression — ${Date.now()}`,
        clientId,
        productId: aaProduct.id,
      }),
    })
  ).project;

  const regressionInputs: Record<string, Record<string, string>> = {
    [WF1_12[0]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Readiness and Opportunity Audit",
      goals: "Assess AI readiness",
    },
    [WF1_12[1]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Readiness and Opportunity Audit",
      goals: "Design system",
      priority_opportunity: "Enquiry triage",
    },
    [WF1_12[2]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Readiness and Opportunity Audit",
      goals: "Implement playbook",
      approved_system_summary: "Triage SOP",
      operator_roles: "Front desk",
    },
    [WF1_12[3]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Process and Task Mapping",
      goals: "Assess process",
      process_scope: "Enquiry intake",
      known_friction: "Shared inbox",
    },
    [WF1_12[4]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Process and Task Mapping",
      goals: "Design process",
      process_selected_for_design: "Enquiry intake",
      current_step_sequence: "Email → book",
    },
    [WF1_12[5]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Process and Task Mapping",
      goals: "Implement process",
      approved_process_design: "intake → book",
      rollout_owners_by_step: "Reception",
    },
    [WF1_12[6]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Use-Case Prioritization and Roadmap",
      goals: "Assess use cases",
      candidate_use_cases: "Triage drafts",
      prioritization_criteria: "Speed",
    },
    [WF1_12[7]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Use-Case Prioritization and Roadmap",
      goals: "Design roadmap",
      shortlisted_use_cases: "Triage",
      scoring_model: "Impact 40%",
    },
    [WF1_12[8]]: {
      client_context: "Business: Summit Dental",
      service_focus: "AI Use-Case Prioritization and Roadmap",
      goals: "Implement roadmap",
      approved_roadmap_design: "Wave 1",
      wave_owners: "Owner",
    },
    [WF1_12[9]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Prompt Systems and Workflow SOPs",
      goals: "Assess prompts",
      prompt_sop_scope: "Replies",
      existing_prompts_sops: "Ad-hoc",
    },
    [WF1_12[10]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Prompt Systems and Workflow SOPs",
      goals: "Design prompts",
      priority_prompt_workflows: "Replies",
      prompt_library_structure: "By role",
    },
    [WF1_12[11]]: {
      client_context: "Business: Summit Dental",
      service_focus: "Prompt Systems and Workflow SOPs",
      goals: "Implement prompts",
      approved_prompt_system_design: "Library",
      implementation_owners: "Owner",
    },
  };

  for (let i = 0; i < WF1_12.length; i++) {
    const key = WF1_12[i];
    const wf = aaAll.find((w: Wf) => w.key === key);
    assert(wf, `missing ${key}`);
    assert(wf.displayOrder === i + 1, `${key} order`);
    const prep = await req("/api/workflows/engine/prepare", {
      method: "POST",
      token,
      body: JSON.stringify({
        workflowId: wf.id,
        projectId: projectAa.id,
        clientId,
        inputs: regressionInputs[key],
      }),
    });
    assert(prep.ready, `${key} prepare`);
    assert(prep.context.workflow.id === wf.id, `${key} id`);
    assert(prep.context.service?.id === wf.serviceResourceId, `${key} service`);
  }

  // Independent save for WF13 vs WF12
  const wf12 = aaAll.find((w: Wf) => w.key === WF1_12[11])!;
  const wf13row = aaSorted[12];
  const prep12 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf12.id,
      projectId: projectAa.id,
      clientId,
      inputs: regressionInputs[WF1_12[11]],
    }),
  });
  const prep13 = await req("/api/workflows/engine/prepare", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf13row.id,
      projectId: projectAa.id,
      clientId,
      inputs: {
        client_context: "Business: Summit Dental",
        service_focus: "Marketing and Content Workflow Enablement",
        goals: "Assess content readiness",
        content_workflow_scope: "Social + email",
        current_content_practices: "Owner drafts ad-hoc",
      },
    }),
  });
  assert(prep13.ready && /Social \+ email|content/i.test(prep13.instruction), "WF13 prepare");
  assert(prep12.instruction !== prep13.instruction, "WF12≠WF13");

  const save12 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf12.id,
      projectId: projectAa.id,
      instruction: prep12.instruction,
      output: "## WF12",
      reviewStatus: "APPROVED",
      title: "WF12 save",
    }),
  });
  const save13 = await req("/api/workflows/engine/save-result", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: wf13row.id,
      projectId: projectAa.id,
      instruction: prep13.instruction,
      output: "## WF13",
      reviewStatus: "APPROVED",
      title: "WF13 save",
    }),
  });
  const aaResults = (
    await req(`/api/workflows/results?projectId=${projectAa.id}`, { token })
  ).results as Array<{ id: string; workflowKey: string }>;
  assert(aaResults.some((r) => r.id === save12.result.id && r.workflowKey === wf12.key), "WF12 restore");
  assert(aaResults.some((r) => r.id === save13.result.id && r.workflowKey === wf13row.key), "WF13 restore");
  assert(
    !aaResults.filter((r) => r.workflowKey === wf13row.key).some((r) => r.id === save12.result.id),
    "WF12 not under WF13"
  );

  console.log("PASS — Full catalog WF13–306 + WF1–12 regression");
  console.log(`  products: 10`);
  console.log(`  workflows: ${total}`);
  console.log(`  unique keys/ids: ${allKeys.size}/${allIds.size}`);
  console.log(`  samples specialized: ${samples.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
