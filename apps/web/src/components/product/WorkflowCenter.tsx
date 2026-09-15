"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch } from "@/lib/api";
import type { ProductResource, WorkflowDef } from "./types";

export function WorkflowCard({
  workflow,
  index,
  serviceName,
  href,
  status,
}: {
  workflow: WorkflowDef;
  index: number;
  serviceName: string;
  href: string;
  status: string;
}) {
  const outputType =
    workflow.outputDefinition && typeof workflow.outputDefinition === "object"
      ? (workflow.outputDefinition as { deliverableType?: string }).deliverableType
      : undefined;
  const inputCount = Array.isArray(workflow.inputs) ? workflow.inputs.length : 0;

  return (
    <article className="item-card">
      <div className="item-card-top">
        <span className="badge">#{index}</span>
        <span className="badge">{status}</span>
      </div>
      <h3>{workflow.name}</h3>
      <p>{workflow.purpose || workflow.description}</p>
      <p className="list-meta">
        {serviceName}
        {outputType ? ` · ${outputType}` : ""}
        {inputCount ? ` · ${inputCount} inputs` : ""}
        {" · Human review"}
      </p>
      <Link className="btn" href={href}>
        Open workflow
      </Link>
    </article>
  );
}

export function WorkflowCenter({
  slug,
  services,
  selectedServiceId,
  onServiceChange,
  completedKeys,
}: {
  slug: string;
  services: ProductResource[];
  selectedServiceId: string | null;
  onServiceChange: (id: string) => void;
  completedKeys: Set<string>;
}) {
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "not-started">("all");

  useEffect(() => {
    if (!selectedServiceId) return;
    setLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ workflows: WorkflowDef[] }>(
          `/api/products/${slug}/services/${selectedServiceId}/workflows`
        );
        setWorkflows(data.workflows);
      } catch {
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, selectedServiceId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((wf) => {
      const done = completedKeys.has(wf.key);
      if (statusFilter === "completed" && !done) return false;
      if (statusFilter === "not-started" && done) return false;
      if (!q) return true;
      return (
        wf.name.toLowerCase().includes(q) ||
        (wf.purpose || "").toLowerCase().includes(q) ||
        (wf.description || "").toLowerCase().includes(q)
      );
    });
  }, [workflows, search, statusFilter, completedKeys]);

  const serviceName =
    services.find((s) => s.id === selectedServiceId)?.title || "Service";

  return (
    <section id="workflows" className="product-section panel">
      <div className="section-heading">
        <h2>Workflow center</h2>
        <span className="muted">{filtered.length} shown</span>
      </div>
      <div className="workflow-center-toolbar">
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows…"
          />
        </label>
        <label>
          Service
          <select
            value={selectedServiceId || ""}
            onChange={(e) => onServiceChange(e.target.value)}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All</option>
            <option value="not-started">Not started</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p className="muted">Loading workflows…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No workflows match." description="Try another service or clear filters." />
      ) : (
        <div className="item-grid">
          {filtered.map((wf, i) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              index={i + 1}
              serviceName={serviceName}
              href={`/products/${slug}/workflows/${wf.id}`}
              status={completedKeys.has(wf.key) ? "Completed" : "Not started"}
            />
          ))}
        </div>
      )}
    </section>
  );
}
