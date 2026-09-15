"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch, ApiClientError } from "@/lib/api";

type WikiSection = { id: string; title: string; items: string[] };

export function WikiCenter() {
  const [sections, setSections] = useState<WikiSection[]>([]);
  const [title, setTitle] = useState("Agency Wiki");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{
          resource: {
            title: string;
            content: { sections?: WikiSection[] };
          };
        }>("/api/shared/agency-wiki");
        setTitle(data.resource.title);
        const secs = data.resource.content.sections || [];
        setSections(secs);
        setActiveId(secs[0]?.id || null);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load wiki");
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.items.some((i) => i.toLowerCase().includes(q))
    );
  }, [sections, query]);

  const active = filtered.find((s) => s.id === activeId) || filtered[0];

  return (
    <section id="wiki" className="product-section panel">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="muted">Shared across all agencies</span>
      </div>
      {error ? (
        <EmptyState title="Unable to load wiki" description={error} />
      ) : (
        <>
          <label>
            Search wiki
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
            />
          </label>
          <div className="resource-tabs" style={{ marginTop: "0.85rem" }}>
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className={active?.id === s.id ? "tab active" : "tab"}
                onClick={() => setActiveId(s.id)}
              >
                {s.title}
              </button>
            ))}
          </div>
          {active ? (
            <div>
              <h3>{active.title}</h3>
              <ul>
                {active.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="No matching wiki topics." />
          )}
        </>
      )}
    </section>
  );
}

export function HelpSection() {
  const steps = [
    "Configure your agency",
    "Select services",
    "Select a client",
    "Choose a workflow",
    "Provide inputs",
    "Prepare the AI instruction",
    "Run it on an external AI platform",
    "Review the output",
    "Save the result",
  ];
  return (
    <section id="help" className="product-section panel">
      <h2 style={{ marginTop: 0 }}>How it works</h2>
      <div className="help-steps">
        {steps.map((step, i) => (
          <div key={step} className="help-step">
            <strong>Step {i + 1}</strong>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResultList({
  results,
}: {
  results: Array<{
    id: string;
    title: string | null;
    workflowKey: string;
    createdAt: string;
    content: { reviewStatus?: string; finalOutput?: string };
  }>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = results.find((r) => r.id === openId);

  return (
    <section id="results" className="product-section panel">
      <h2 style={{ marginTop: 0 }}>Saved results</h2>
      {results.length === 0 ? (
        <EmptyState
          title="No saved results yet"
          description="Run a workflow and complete human review to save deliverables."
        />
      ) : (
        <ul className="simple-list">
          {results.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.title || r.workflowKey}</strong>
                <span className="list-meta">
                  {r.workflowKey} · {new Date(r.createdAt).toLocaleString()}
                  {r.content?.reviewStatus ? ` · ${r.content.reviewStatus}` : ""}
                </span>
              </div>
              <button type="button" className="btn ghost" onClick={() => setOpenId(r.id)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="section-heading">
            <h3 style={{ margin: 0 }}>{open.title || open.workflowKey}</h3>
            <button type="button" className="btn ghost" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
          <pre className="code-block">{open.content?.finalOutput || "(empty)"}</pre>
        </div>
      ) : null}
    </section>
  );
}

export function ProductFooter({ productName }: { productName: string }) {
  return (
    <footer className="product-footer">
      <div className="product-footer-inner">
        <div>
          <strong>AI Enterprise Studio</strong>
          <div>{productName}</div>
          <div className="muted">Stage 4 · aienterprisestudio.com</div>
        </div>
        <nav>
          <a href="#help">Help</a>
          <a href="#wiki">Wiki</a>
          <a href="/account">Account</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </div>
    </footer>
  );
}
