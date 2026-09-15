"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalAIButtons } from "./WorkflowRunnerBits";
import type { ClientRow, SetupConfig, WorkflowDef, WorkflowInputField } from "./types";
import { apiFetch, ApiClientError } from "@/lib/api";

export type WorkflowRunnerState =
  | "NOT_STARTED"
  | "INPUTS_COMPLETED"
  | "PROMPT_READY"
  | "AI_OUTPUT_RECEIVED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "SAVED";

const STATE_LABELS: Array<{ key: WorkflowRunnerState; label: string }> = [
  { key: "NOT_STARTED", label: "Not started" },
  { key: "INPUTS_COMPLETED", label: "Inputs" },
  { key: "PROMPT_READY", label: "Prompt ready" },
  { key: "AI_OUTPUT_RECEIVED", label: "AI output" },
  { key: "UNDER_REVIEW", label: "Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "SAVED", label: "Saved" },
];

function stateIndex(s: WorkflowRunnerState): number {
  return STATE_LABELS.findIndex((x) => x.key === s);
}

type Props = {
  workflow: WorkflowDef;
  productId: string;
  productName: string;
  serviceTitle: string;
  setup: SetupConfig;
  clientDraft: {
    name: string;
    industry: string;
    location: string;
    notes: string;
  };
  ensureClientAndProject: () => Promise<{ clientId: string; projectId: string }>;
  onClose: () => void;
  onToast: (msg: string) => void;
};

function asInputFields(inputs: unknown): WorkflowInputField[] {
  if (!Array.isArray(inputs)) return [];
  return inputs.filter(
    (f): f is WorkflowInputField =>
      !!f && typeof f === "object" && typeof (f as WorkflowInputField).key === "string"
  );
}

export function InlineWorkflowRunner({
  workflow,
  productId,
  productName,
  serviceTitle,
  setup,
  clientDraft,
  ensureClientAndProject,
  onClose,
  onToast,
}: Props) {
  const fields = useMemo(() => asInputFields(workflow.inputs), [workflow.inputs]);
  const checklist = workflow.reviewRequirements?.checklist || [];
  const outputSections = workflow.outputDefinition?.sections || [];

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [runnerState, setRunnerState] = useState<WorkflowRunnerState>("NOT_STARTED");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedResults, setSavedResults] = useState<
    Array<{ id: string; text: string; ts: string; reviewStatus?: string }>
  >([]);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Prefill inputs from agency/client context; reset when workflow id changes
  useEffect(() => {
    if (!workflow.serviceResourceId) {
      setMappingError(
        "This workflow has no valid service mapping. It cannot run until Product → Service → Workflow is fixed."
      );
    } else {
      setMappingError(null);
    }

    const clientContext = [
      clientDraft.name && `Business: ${clientDraft.name}`,
      clientDraft.industry && `Industry: ${clientDraft.industry}`,
      clientDraft.location && `Location: ${clientDraft.location}`,
      clientDraft.notes && `Notes: ${clientDraft.notes}`,
    ]
      .filter(Boolean)
      .join("\n");

    const next: Record<string, string> = {};
    for (const f of asInputFields(workflow.inputs)) {
      if (f.key === "client_context") next[f.key] = clientContext;
      else if (f.key === "service_focus") next[f.key] = serviceTitle || f.placeholder || "";
      else if (f.key === "goals") next[f.key] = clientDraft.notes || "";
      else next[f.key] = "";
    }
    setInputs(next);
    setPaste("");
    setMissing([]);
    setReviewed({});
    setReviewConfirmed(false);
    setMsg(null);
    setRunnerState("NOT_STARTED");
    setSavedResults([]);
  }, [workflow.id, workflow.serviceResourceId, workflow.inputs, serviceTitle, clientDraft.name, clientDraft.industry, clientDraft.location, clientDraft.notes]);

  // Build the customized prompt only after agency profile details are entered
  useEffect(() => {
    if (mappingError) {
      setInstruction("");
      return;
    }
    const country = (setup.country || "").trim();
    const niche = (setup.targetNiche || "").trim();
    if (!country || !niche) {
      setInstruction("");
      const need: string[] = [];
      if (!country) need.push("Operating market / country");
      if (!niche) need.push("Target niche");
      setMissing(need);
      setMsg("Enter your agency profile details above (country and target niche). The customized prompt will generate here after that.");
      setRunnerState("NOT_STARTED");
      return;
    }

    const line = (label: string, val: string | null | undefined, fallback: string) =>
      `${label}: ${val && String(val).trim() ? String(val).trim() : fallback}`;
    const agency = (setup.agencyName || "").trim() || productName;
    const clientContext = [
      clientDraft.name && `Business: ${clientDraft.name}`,
      clientDraft.industry && `Industry: ${clientDraft.industry}`,
      clientDraft.location && `Location: ${clientDraft.location}`,
      clientDraft.notes && `Notes: ${clientDraft.notes}`,
    ]
      .filter(Boolean)
      .join("\n");

    const values: Record<string, string> = {
      ...inputs,
      client_context: inputs.client_context || clientContext,
      service_focus: inputs.service_focus || serviceTitle || "",
      goals: inputs.goals || clientDraft.notes || "",
      agency_name: agency,
      target_niche: niche,
      country,
      geographic_service_area: setup.geographicServiceArea || "",
      ai_platform: setup.aiPlatform || "",
      preferred_delivery_model: setup.preferredDeliveryModel || "",
    };

    const template =
      workflow.aiInstructionTemplate ||
      `Produce a professional deliverable for ${workflow.name}.\n\nPurpose: ${workflow.purpose || workflow.description || ""}\n\nClient:\n{{client_context}}\n\nGoals:\n{{goals}}`;

    const taskBody = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = values[key];
      return v && String(v).trim() ? String(v) : "(not provided)";
    });

    const prompt = [
      `ROLE\nYou are an experienced AI-enablement consultant working inside ${agency}. You produce practical, professional deliverables for small local businesses. You avoid hype, keep language plain, and flag anything that needs human verification before client use.`,
      `AGENCY CONTEXT\n${[
        line("Operating market", country, "not specified"),
        line("Target niche", niche, "local service businesses"),
        line("Service area", setup.geographicServiceArea, "not specified"),
        line("Experience level", setup.experienceLevel, "beginner"),
        line("Delivery model", setup.preferredDeliveryModel, "audit plus implementation"),
        line("Weekly time available", setup.weeklyTimeAvailability, "limited"),
        line("Income or client target", setup.monthlyIncomeOrClientTarget, "not specified"),
        line("Preferred AI platform", setup.aiPlatform, "not specified"),
      ].join("\n")}`,
      `CLIENT CONTEXT\n${
        clientContext ||
        "No specific client yet - keep the output reusable for a typical business in the target niche."
      }`,
      `TASK\n${taskBody}`,
      `OUTPUT FORMAT\nReturn only the deliverable. Do not add a preamble or closing note.`,
    ].join("\n\n");

    setInstruction(prompt);
    setMissing([]);
    setMsg("Prompt ready. Copy it into your AI, then paste the response below.");
    setRunnerState("PROMPT_READY");
  }, [
    mappingError,
    productName,
    workflow.name,
    workflow.purpose,
    workflow.description,
    workflow.aiInstructionTemplate,
    setup.agencyName,
    setup.country,
    setup.targetNiche,
    setup.geographicServiceArea,
    setup.experienceLevel,
    setup.preferredDeliveryModel,
    setup.weeklyTimeAvailability,
    setup.monthlyIncomeOrClientTarget,
    setup.aiPlatform,
    clientDraft.name,
    clientDraft.industry,
    clientDraft.location,
    clientDraft.notes,
    inputs,
    serviceTitle,
  ]);

  // Restore prior saved results for this workflow
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await ensureClientAndProject();
        if (cancelled) return;
        setProjectId(ctx.projectId);
        const data = await apiFetch<{
          results: Array<{
            id: string;
            workflowKey: string;
            createdAt: string;
            content: {
              finalOutput?: string;
              output?: string;
              instruction?: string;
              inputs?: Record<string, string>;
              reviewStatus?: string;
              workflowId?: string;
            };
            metadata?: { productId?: string; serviceResourceId?: string | null };
          }>;
        }>(`/api/workflows/results?projectId=${encodeURIComponent(ctx.projectId)}`);

        const mine = data.results.filter(
          (r) =>
            r.workflowKey === workflow.key ||
            r.content?.workflowId === workflow.id ||
            (r.metadata?.productId === productId && r.workflowKey === workflow.key)
        );

        if (cancelled) return;

        setSavedResults(
          mine.map((r) => ({
            id: r.id,
            text: r.content?.finalOutput || r.content?.output || "",
            ts: new Date(r.createdAt).toLocaleString(),
            reviewStatus: r.content?.reviewStatus,
          }))
        );

        const latest = mine[0];
        if (latest?.content) {
          // Keep the live customized prompt from current agency details;
          // only restore pasted output / review state from prior runs.
          if (latest.content.finalOutput || latest.content.output) {
            setPaste(latest.content.finalOutput || latest.content.output || "");
          }
          if (latest.content.inputs && typeof latest.content.inputs === "object") {
            setInputs((prev) => ({ ...prev, ...latest.content.inputs }));
          }
          if (latest.content.reviewStatus === "APPROVED") {
            setReviewConfirmed(true);
            setRunnerState("SAVED");
          } else if (latest.content.finalOutput || latest.content.output) {
            setRunnerState("AI_OUTPUT_RECEIVED");
          }
        }
      } catch {
        /* optional restore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally only when workflow changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  function setField(key: string, value: string) {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setRunnerState((s) => (stateIndex(s) < stateIndex("INPUTS_COMPLETED") ? "INPUTS_COMPLETED" : s));
  }

  function toggleReviewItem(item: string) {
    setReviewed((prev) => ({ ...prev, [item]: !prev[item] }));
    setRunnerState("UNDER_REVIEW");
  }

  const allReviewsChecked =
    checklist.length === 0 || checklist.every((item) => reviewed[item]);

  async function prepareInstruction() {
    if (mappingError) {
      onToast(mappingError);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const ctx = await ensureClientAndProject();
      setProjectId(ctx.projectId);

      // Client-side required check first
      const localMissing = fields
        .filter((f) => f.required)
        .filter((f) => !(inputs[f.key] || "").trim())
        .map((f) => f.label || f.key);
      if (localMissing.length) {
        setMissing(localMissing);
        setMsg(`Missing required inputs: ${localMissing.join(", ")}`);
        setRunnerState("NOT_STARTED");
        return;
      }

      const data = await apiFetch<{
        instruction: string;
        missingRequired: string[];
        ready: boolean;
        context: {
          service: { id: string; title: string } | null;
          product: { id: string; slug: string; name: string };
        };
      }>("/api/workflows/engine/prepare", {
        method: "POST",
        body: JSON.stringify({
          workflowId: workflow.id,
          projectId: ctx.projectId,
          clientId: ctx.clientId,
          inputs,
        }),
      });

      if (data.context.product.id !== productId) {
        throw new Error("Prepared instruction belongs to a different product.");
      }
      if (!data.context.service?.id || data.context.service.id !== workflow.serviceResourceId) {
        throw new Error(
          "Invalid service mapping for this workflow. Fix Product → Service → Workflow linkage."
        );
      }

      setInstruction(data.instruction);
      setMissing(data.missingRequired || []);
      if (!data.ready) {
        setMsg(`Missing required inputs: ${(data.missingRequired || []).join(", ")}`);
        setRunnerState("INPUTS_COMPLETED");
        return;
      }
      setRunnerState("PROMPT_READY");
      setMsg("Instruction ready. Copy it into your AI platform, then paste the response below.");
      onToast("Instruction prepared");
    } catch (err) {
      const text = err instanceof ApiClientError || err instanceof Error ? err.message : "Prepare failed";
      setMsg(text);
      onToast(text);
    } finally {
      setBusy(false);
    }
  }

  async function saveResult() {
    if (mappingError) {
      onToast(mappingError);
      return;
    }
    if (!instruction.trim()) {
      onToast("Prepare the AI instruction first");
      return;
    }
    if (!paste.trim()) {
      onToast("Paste the AI-generated result first");
      return;
    }
    if (!allReviewsChecked || !reviewConfirmed) {
      onToast("Complete human review before saving as approved");
      setRunnerState("UNDER_REVIEW");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const ctx = await ensureClientAndProject();
      setProjectId(ctx.projectId);
      const data = await apiFetch<{ result: { id: string; createdAt?: string } }>(
        "/api/workflows/engine/save-result",
        {
          method: "POST",
          body: JSON.stringify({
            workflowId: workflow.id,
            projectId: ctx.projectId,
            instruction,
            output: paste,
            reviewStatus: "APPROVED",
            reviewNotes: checklist.length
              ? `Checklist confirmed: ${checklist.join("; ")}`
              : "Human review confirmed",
            title: `${workflow.name} — approved result`,
            inputs,
          }),
        }
      );
      setSavedResults((prev) => [
        {
          id: data.result.id,
          text: paste,
          ts: new Date().toLocaleString(),
          reviewStatus: "APPROVED",
        },
        ...prev,
      ]);
      setRunnerState("SAVED");
      setMsg("Result saved against this workflow.");
      onToast("Result saved");
    } catch (err) {
      const text = err instanceof ApiClientError || err instanceof Error ? err.message : "Save failed";
      setMsg(text);
      onToast(text);
    } finally {
      setBusy(false);
    }
  }

  function onPasteChange(value: string) {
    setPaste(value);
    if (value.trim()) {
      setRunnerState((s) =>
        stateIndex(s) < stateIndex("AI_OUTPUT_RECEIVED") ? "AI_OUTPUT_RECEIVED" : s
      );
    }
  }

  function markReviewReady() {
    if (!paste.trim()) {
      onToast("Paste an AI result before review");
      return;
    }
    setRunnerState("UNDER_REVIEW");
    if (allReviewsChecked) {
      setReviewConfirmed(true);
      setRunnerState("APPROVED");
      onToast("Review checklist complete — ready to save");
    } else {
      onToast("Check each review item");
    }
  }

  return (
    <div className="card" id="runner">
      <div className="chead">
        <span className="ic">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          </svg>
        </span>
        <div>
          <h2>Workflow Runner</h2>
          <div className="sub">
            {productName} · loaded by workflow ID · same-page runner
          </div>
        </div>
        <div className="right">
          <button type="button" className="linkbtn" onClick={onClose}>
            Close runner
          </button>
        </div>
      </div>

      <div className="sect" style={{ border: 0, paddingTop: 4 }}>
        <div className="wf-state-rail" aria-label="Workflow state">
          {STATE_LABELS.map((s) => {
            const active = s.key === runnerState;
            const done = stateIndex(s.key) < stateIndex(runnerState);
            return (
              <span
                key={s.key}
                className={active ? "wf-state on" : done ? "wf-state done" : "wf-state"}
              >
                {s.label}
              </span>
            );
          })}
        </div>

        <span className="catchip">Service: {serviceTitle || "Unmapped service"}</span>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-.01em",
            margin: "10px 0 6px",
          }}
        >
          {workflow.name}
        </h2>
        <p style={{ fontSize: 14.5, color: "var(--muted)", margin: 0 }}>
          {workflow.purpose || workflow.description}
        </p>
        {mappingError ? <p className="error" style={{ marginTop: 12 }}>{mappingError}</p> : null}
        {msg ? (
          <p className="hint" style={{ marginTop: 12, color: "var(--deep)" }}>
            {msg}
          </p>
        ) : null}
      </div>

      <div className="sect">
        <h4>Required inputs</h4>
        <div className="hint">
          Complete any workflow-specific fields below. The customized prompt updates automatically after your agency profile details are entered.
        </div>
        <div className="stack" style={{ gap: 14, marginTop: 12 }}>
          {fields.map((f) => (
            <div key={f.key} className={`field ${missing.includes(f.label || f.key) ? "err" : ""}`}>
              <label htmlFor={`wf-in-${f.key}`}>
                {f.label}
                {f.required ? <span className="req"> *</span> : null}
              </label>
              {f.help ? <div className="hint" style={{ marginBottom: 6 }}>{f.help}</div> : null}
              {f.type === "textarea" || (!f.type && f.key !== "service_focus") ? (
                <textarea
                  id={`wf-in-${f.key}`}
                  rows={4}
                  value={inputs[f.key] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  id={`wf-in-${f.key}`}
                  value={inputs[f.key] || ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  <option value="">Select…</option>
                  {(f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`wf-in-${f.key}`}
                  value={inputs[f.key] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
          {fields.length === 0 ? (
            <p className="hint">No input schema on this workflow definition.</p>
          ) : null}
        </div>
        <div className="btnrow" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !!mappingError || !instruction}
            onClick={() => void prepareInstruction()}
          >
            {busy ? "Refreshing…" : "Refresh prompt from server"}
          </button>
        </div>
      </div>

      <div className="sect">
        <h4>Your customized prompt</h4>
        <div className="hint">
          Built from your agency profile and client context after you enter the details above.
          No API keys are used.
        </div>
        <div className="promptbox">
          {instruction ||
            "Enter your agency profile details (country and target niche) to generate the customized prompt."}
        </div>
        <div style={{ marginTop: 12 }}>
          <ExternalAIButtons instruction={instruction} preferred={setup.aiPlatform} />
        </div>
        {outputSections.length ? (
          <div className="hint" style={{ marginTop: 12 }}>
            Expected output sections: {outputSections.join(" · ")}
          </div>
        ) : null}
      </div>

      <div className="pastewrap">
        <h4>Paste AI-generated result here</h4>
        <div className="hint">Obtain the output from your external AI platform, then paste it for review.</div>
        <textarea
          value={paste}
          onChange={(e) => onPasteChange(e.target.value)}
          placeholder="Paste the response from your AI here..."
        />
        <div className="btnrow">
          <button type="button" className="btn ghost" disabled={busy} onClick={markReviewReady}>
            Review Result
          </button>
        </div>
      </div>

      <div className="sect">
        <h4>Human review</h4>
        <div className="hint">
          Confirm each requirement from this workflow. Saving as approved requires full review.
        </div>
        {checklist.length ? (
          <ul className="review-list">
            {checklist.map((item) => (
              <li key={item}>
                <label className="review-item">
                  <input
                    type="checkbox"
                    checked={!!reviewed[item]}
                    onChange={() => toggleReviewItem(item)}
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No checklist defined — confirm you reviewed the output carefully.</p>
        )}
        <label className="review-item" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={(e) => {
              setReviewConfirmed(e.target.checked);
              if (e.target.checked && allReviewsChecked) setRunnerState("APPROVED");
              else setRunnerState("UNDER_REVIEW");
            }}
          />
          <span>I confirm this output is ready for operator use (not auto-approved).</span>
        </label>
        <div className="btnrow" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn lime"
            disabled={busy || !!mappingError || !instruction || !paste.trim()}
            onClick={() => void saveResult()}
          >
            {busy ? "Saving…" : "Save Result"}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {projectId ? (
          <div className="hint" style={{ marginTop: 10 }}>
            Persistence project: {projectId.slice(0, 8)}… · workflow id: {workflow.id.slice(0, 8)}…
          </div>
        ) : null}
      </div>

      {savedResults.length ? (
        <div className="sect">
          <h4>Saved results for this workflow</h4>
          {savedResults.map((r) => (
            <div key={r.id} className="result">
              <div className="rhead">
                <time>
                  Saved {r.ts}
                  {r.reviewStatus ? ` · ${r.reviewStatus}` : ""}
                </time>
              </div>
              <pre>{r.text}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
