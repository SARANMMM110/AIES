"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { Protected } from "@/components/Protected";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import {
  ExternalAIButtons,
  InstructionPanel,
  WorkflowProgress,
} from "@/components/product/WorkflowRunnerBits";
import { productAccent } from "@/components/product/types";
import { apiFetch, ApiClientError } from "@/lib/api";

type InputField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};

type Workflow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  purpose: string | null;
  inputs: InputField[] | null;
  outputDefinition: { deliverableType?: string; sections?: string[] } | null;
  reviewRequirements: { checklist?: string[] } | null;
  nextAction: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    configuration?: Record<string, unknown> | null;
  };
  serviceResource: { id: string; title: string; slug: string } | null;
};

type ClientRow = { id: string; name: string; industry: string | null };
type ProjectRow = { id: string; name: string; clientId: string; productId: string | null };

export default function WorkflowRunnerPage() {
  const params = useParams<{ slug: string; workflowId: string }>();
  const slug = params.slug;
  const workflowId = params.workflowId;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [aiPlatform, setAiPlatform] = useState("Custom / Other");
  const [output, setOutput] = useState("");
  const [editedOutput, setEditedOutput] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "NEEDS_EDIT" | "REJECTED">(
    "APPROVED"
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [wikiHelp, setWikiHelp] = useState<
    Array<{ id: string; title: string; slug: string; category: { slug: string; name: string } }>
  >([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [wf, c, p, product] = await Promise.all([
          apiFetch<{ workflow: Workflow }>(`/api/workflows/definitions/${workflowId}`),
          apiFetch<{ clients: ClientRow[] }>("/api/clients"),
          apiFetch<{ projects: ProjectRow[] }>("/api/projects"),
          apiFetch<{ product: { configuration?: Record<string, unknown> } }>(
            `/api/products/${slug}`
          ).catch(() => null),
        ]);
        if (wf.workflow.product.slug !== slug) {
          setError("Workflow does not belong to this agency product.");
          return;
        }
        if (product?.product) {
          wf.workflow.product.configuration = product.product.configuration;
        }
        setWorkflow(wf.workflow);
        setClients(c.clients);
        const productProjects = p.projects.filter(
          (pr) => !pr.productId || pr.productId === wf.workflow.product.id
        );
        setProjects(productProjects);
        if (c.clients[0]) setClientId(c.clients[0].id);
        const matching = productProjects.find((pr) => pr.clientId === c.clients[0]?.id);
        if (matching) setProjectId(matching.id);
        setStep(2);
        try {
          const help = await apiFetch<{
            articles: Array<{
              id: string;
              title: string;
              slug: string;
              category: { slug: string; name: string };
            }>;
          }>(`/api/wiki/workflow-links/${workflowId}`);
          setWikiHelp(help.articles ?? []);
        } catch {
          setWikiHelp([]);
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load workflow");
      } finally {
        setLoading(false);
      }
    })();
  }, [workflowId, slug]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fields = useMemo(() => {
    if (!workflow || !Array.isArray(workflow.inputs)) return [];
    return workflow.inputs;
  }, [workflow]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => !clientId || p.clientId === clientId),
    [projects, clientId]
  );

  async function ensureProject(): Promise<string> {
    if (projectId) return projectId;
    if (!clientId || !workflow) throw new Error("Select a client before saving.");
    const created = await apiFetch<{ project: ProjectRow }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: `${workflow.product.name} — ${clients.find((c) => c.id === clientId)?.name || "Client"}`,
        clientId,
        productId: workflow.product.id,
      }),
    });
    setProjects((prev) => [created.project, ...prev]);
    setProjectId(created.project.id);
    return created.project.id;
  }

  async function generateInstruction(e?: FormEvent) {
    e?.preventDefault();
    if (!workflow) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiFetch<{
        instruction: string;
        missingRequired: string[];
        ready: boolean;
        context: { aiPlatform: string };
      }>("/api/workflows/engine/prepare", {
        method: "POST",
        body: JSON.stringify({
          workflowId: workflow.id,
          projectId: projectId || undefined,
          clientId: clientId || undefined,
          inputs,
        }),
      });
      setInstruction(data.instruction);
      setMissing(data.missingRequired || []);
      setAiPlatform(data.context.aiPlatform);
      setDirty(true);
      setStep(data.ready ? 4 : 3);
      setMsg(
        data.ready
          ? "Instruction ready. Copy or open your AI platform, then paste the response."
          : `Missing required inputs: ${data.missingRequired.join(", ")}`
      );
    } catch (err) {
      setMsg(err instanceof ApiClientError ? err.message : "Could not prepare instruction");
    } finally {
      setBusy(false);
    }
  }

  async function saveResult(e: FormEvent) {
    e.preventDefault();
    if (!workflow) return;
    if (!instruction.trim() || !output.trim()) {
      setMsg("Generate an instruction and provide AI output before saving.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const pid = await ensureProject();
      const data = await apiFetch<{ result: { id: string }; nextAction: string | null }>(
        "/api/workflows/engine/save-result",
        {
          method: "POST",
          body: JSON.stringify({
            workflowId: workflow.id,
            projectId: pid,
            instruction,
            output,
            editedOutput: editedOutput || undefined,
            reviewStatus,
            reviewNotes: reviewNotes || undefined,
            title: `${workflow.name} — ${reviewStatus}`,
            inputs,
          }),
        }
      );
      setStep(6);
      setDirty(false);
      setMsg(
        `Saved. ${data.nextAction ? `Next: ${data.nextAction}` : "Result stored for reuse."}`
      );
    } catch (err) {
      setMsg(err instanceof ApiClientError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Protected>
        <ToolLoadingPulse label="Loading workflow" />
      </Protected>
    );
  }

  if (error || !workflow) {
    return (
      <Protected>
        <div className="product-main panel">
          <EmptyState
            title="Unable to open workflow"
            description={error || "Not found"}
            action={
              <Link className="btn" href={`/products/${slug}#workflows`}>
                Back to workflows
              </Link>
            }
          />
        </div>
      </Protected>
    );
  }

  const accent = productAccent(workflow.product.configuration);

  return (
    <Protected>
      <div className="product-root" style={{ ["--product-accent" as string]: accent }}>
        <header className="product-topnav">
          <div className="product-topnav-brand">
            <span className="brand-mark">AES</span>
            <div>
              <strong>{workflow.product.name}</strong>
              <span>{workflow.serviceResource?.title || "Workflow"}</span>
            </div>
          </div>
          <div className="product-topnav-actions">
            <Link className="btn ghost" href="/wiki">
              Need help with this?
            </Link>
            <Link
              className="btn ghost"
              href={`/products/${slug}#workflows`}
              onClick={(e) => {
                if (dirty && !confirm("You have unsaved work. Leave this workflow?")) {
                  e.preventDefault();
                }
              }}
            >
              Back
            </Link>
          </div>
        </header>
        <div className="product-main stack-lg">
          <div>
            <p className="product-kicker">Guided workflow</p>
            <h1 className="page-title" style={{ marginBottom: "0.35rem" }}>
              {workflow.name}
            </h1>
            <p className="page-sub">{workflow.purpose || workflow.description}</p>
            {wikiHelp.length ? (
              <div className="wiki-workflow-help" style={{ marginTop: 10 }}>
                <span className="muted">Need help with this? </span>
                {wikiHelp.map((a) => (
                  <Link
                    key={a.id}
                    href={`/wiki/${a.category.slug}/${a.slug}`}
                    className="btn ghost"
                    style={{ marginRight: 6, marginTop: 4 }}
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: 8 }}>
                <Link href="/wiki" className="muted">
                  Need help with this? Open Agency Wiki →
                </Link>
              </p>
            )}
            <WorkflowProgress step={step} />
          </div>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>01 Context</h2>
            <div className="form-grid">
              <label>
                Client
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setDirty(true);
                    setStep(2);
                    const next = projects.find((p) => p.clientId === e.target.value);
                    setProjectId(next?.id || "");
                  }}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.industry ? ` (${c.industry})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">Auto-create on save…</option>
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>02 Inputs</h2>
            <form className="form" onSubmit={(e) => void generateInstruction(e)}>
              {fields.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {field.required ? " *" : ""}
                  {field.type === "textarea" || field.key.includes("context") ? (
                    <textarea
                      rows={4}
                      placeholder={field.placeholder}
                      value={inputs[field.key] || ""}
                      onChange={(e) => {
                        setInputs({ ...inputs, [field.key]: e.target.value });
                        setDirty(true);
                      }}
                    />
                  ) : field.type === "select" && field.options ? (
                    <select
                      value={inputs[field.key] || ""}
                      onChange={(e) => {
                        setInputs({ ...inputs, [field.key]: e.target.value });
                        setDirty(true);
                      }}
                    >
                      <option value="">Select…</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      placeholder={field.placeholder}
                      value={inputs[field.key] || ""}
                      onChange={(e) => {
                        setInputs({ ...inputs, [field.key]: e.target.value });
                        setDirty(true);
                      }}
                    />
                  )}
                  {field.help ? <span className="field-help">{field.help}</span> : null}
                </label>
              ))}
              <button className="btn" type="submit" disabled={busy}>
                03 Prepare AI instruction
              </button>
            </form>
            {missing.length ? (
              <p className="error-text">Still required: {missing.join(", ")}</p>
            ) : null}
          </section>

          <section className="panel">
            <InstructionPanel
              instruction={instruction}
              onChange={(v) => {
                setInstruction(v);
                setDirty(true);
              }}
            />
            <h3>04 Run externally or with connected AI</h3>
            <ExternalAIButtons instruction={instruction} preferred={aiPlatform} />
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={busy || !instruction}
                onClick={() =>
                  void (async () => {
                    if (!workflow || !instruction) return;
                    setBusy(true);
                    setMsg(null);
                    try {
                      const data = await apiFetch<{
                        output: string;
                        notice?: string;
                      }>("/api/workflows/engine/generate", {
                        method: "POST",
                        body: JSON.stringify({
                          workflowId: workflow.id,
                          instruction,
                          inputs,
                        }),
                      });
                      setOutput(data.output);
                      setEditedOutput(data.output);
                      setDirty(true);
                      setStep(5);
                      setMsg(data.notice || "AI-generated output — review before use.");
                    } catch (err) {
                      setMsg(
                        err instanceof ApiClientError
                          ? err.message
                          : "Connected AI unavailable — use manual / external mode."
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                Generate with connected AI
              </button>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                Optional. Manual copy/paste mode remains available. AI output is a draft requiring
                human review.
              </p>
            </div>
          </section>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>05 Review</h2>
            <label>
              Paste AI response
              <textarea
                rows={10}
                value={output}
                onChange={(e) => {
                  setOutput(e.target.value);
                  if (!editedOutput) setEditedOutput(e.target.value);
                  setDirty(true);
                  setStep(5);
                }}
                placeholder="Paste the AI-generated deliverable…"
              />
            </label>
            {workflow.reviewRequirements?.checklist?.length ? (
              <ul className="step-list">
                {workflow.reviewRequirements.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <form className="form" onSubmit={(e) => void saveResult(e)}>
              <label>
                Edit before save
                <textarea
                  rows={8}
                  value={editedOutput}
                  onChange={(e) => {
                    setEditedOutput(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                Review decision
                <select
                  value={reviewStatus}
                  onChange={(e) =>
                    setReviewStatus(e.target.value as typeof reviewStatus)
                  }
                >
                  <option value="APPROVED">Approve</option>
                  <option value="NEEDS_EDIT">Needs edit</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </label>
              <label>
                Review notes
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </label>
              <button className="btn" type="submit" disabled={busy}>
                06 Save result
              </button>
            </form>
            {workflow.nextAction ? (
              <p className="muted" style={{ marginTop: "1rem" }}>
                Suggested next: {workflow.nextAction}
              </p>
            ) : null}
            {msg ? <p className="success">{msg}</p> : null}
          </section>
        </div>
      </div>
    </Protected>
  );
}
