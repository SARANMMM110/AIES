"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import type { ProductResource } from "./types";

const ORDER = [
  "OPERATOR_GUIDE",
  "BUSINESS_STRATEGY",
  "SALES_PAGE",
  "SALES_COPY",
  "POSITIONING",
];

export function ResourceCenter({ resources }: { resources: ProductResource[] }) {
  const ordered = useMemo(
    () =>
      [...resources].sort(
        (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)
      ),
    [resources]
  );
  const [activeId, setActiveId] = useState(ordered[0]?.id || null);
  const active = ordered.find((r) => r.id === activeId) || ordered[0];

  return (
    <section id="resources" className="product-section panel">
      <div className="section-heading">
        <h2>Resources</h2>
      </div>
      <div className="resource-tabs" role="tablist">
        {ordered.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={active?.id === r.id}
            className={active?.id === r.id ? "tab active" : "tab"}
            onClick={() => setActiveId(r.id)}
          >
            {r.title.replace(/^.*?—\s*/, "")}
          </button>
        ))}
      </div>
      {!active ? (
        <EmptyState title="No resources yet." />
      ) : (
        <div>
          <h3>{active.title}</h3>
          <p className="muted">{active.description}</p>
          <ResourceBody resource={active} />
        </div>
      )}
    </section>
  );
}

function ResourceBody({ resource }: { resource: ProductResource }) {
  const content = (resource.content || {}) as Record<string, unknown>;
  if (resource.type === "SALES_PAGE" && typeof content.html === "string") {
    return <iframe title={resource.title} className="sales-frame" srcDoc={content.html} />;
  }
  const body = content.body;
  if (body && typeof body === "object") {
    return (
      <div className="resource-prose">
        {Object.entries(body as Record<string, unknown>).map(([key, value]) => (
          <div key={key}>
            <h4>{key.replace(/([A-Z])/g, " $1")}</h4>
            {Array.isArray(value) ? (
              <ul>
                {value.map((item) => (
                  <li key={String(item)}>{String(item)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">{String(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  }
  const nested = content.strategy || content.copy || content.positioning || content;
  return <pre className="code-block">{JSON.stringify(nested, null, 2)}</pre>;
}
