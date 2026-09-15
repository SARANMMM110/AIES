"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatMoney } from "@/lib/purchase";
import { displayAgencyName } from "@/components/product/ProductShell";
import { productAccent, type ProductWorkspace } from "@/components/product/types";
import { useNavigateBack } from "@/hooks/useNavigateBack";
import "@/app/sales/sales-layout.css";
import "@/app/agency-studio.css";
import "@/components/sales/purchase-flow.css";

type PreviewProduct = Pick<
  ProductWorkspace,
  | "name"
  | "slug"
  | "shortDescription"
  | "tagline"
  | "description"
  | "icon"
  | "priceCents"
  | "currency"
  | "configuration"
  | "serviceCount"
  | "workflowCount"
> & {
  services?: Array<{ id: string; title: string; slug: string; description: string | null }>;
  workflowCatalog?: { definedCount?: number; targetCount?: number };
};

type PreviewMode = "agency" | "sales";

const FEATURES: Array<{ label: string; svg: React.ReactNode }> = [
  {
    label: "Practical AI Opportunities",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      </svg>
    ),
  },
  {
    label: "More Efficient Workflows",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="10" width="4" height="10" rx="1" />
      </svg>
    ),
  },
  {
    label: "Real Business Improvement",
    svg: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.8 20c.6-3.2 3.2-5 6.2-5s5.6 1.8 6.2 5" />
        <circle cx="17.5" cy="9.5" r="2.5" />
        <path d="M15.5 14.6c2.9-.3 5.2 1.3 5.7 4.4" />
      </svg>
    ),
  },
];

/** Locked agency — same visual as unlocked agency workspace, read-only. */
export function LockedAgencyPreview({ product }: { product: PreviewProduct }) {
  const accent = productAccent(product.configuration);
  const services = product.services ?? [];
  const title = displayAgencyName(product.name);
  const eyebrow = product.tagline || "Agency Operating System";
  const wfCount =
    product.workflowCatalog?.definedCount ??
    product.workflowCatalog?.targetCount ??
    product.workflowCount ??
    0;
  const [mode, setMode] = useState<PreviewMode>("agency");
  const goBack = useNavigateBack("/dashboard");

  return (
    <div className="locked-agency-shell">
      <div className="locked-agency-chrome">
      <header className="locked-agency-topnav">
        <Link className="locked-agency-topnav-brand" href="/products">
          <span className="brand-mark" aria-hidden>
            ▲
          </span>
          AI Enterprise Studio
        </Link>
        <div className="locked-agency-nav-actions">
          <Link className="btn lime" href={`/contact?focus=${encodeURIComponent(product.slug)}`}>
            Request access →
          </Link>
          <button type="button" className="btn ghost" onClick={goBack}>
            Back
          </button>
        </div>
      </header>

      <div className="locked-agency-modebar">
        <div className="locked-agency-preview-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "agency"}
            className={mode === "agency" ? "active" : ""}
            onClick={() => setMode("agency")}
          >
            Agency preview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sales"}
            className={mode === "sales" ? "active" : ""}
            onClick={() => setMode("sales")}
          >
            Sales page preview
          </button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {formatMoney(product.priceCents, product.currency)} · view only
        </span>
      </div>
      </div>

      {mode === "agency" ? (
        <div
          className="agency-studio locked-agency-studio-frame"
          style={{ ["--agency-accent" as string]: accent } as CSSProperties}
        >
          <div className="wrap" style={{ paddingTop: 8, paddingBottom: 40, maxWidth: "100%" }}>
            <header className="top">
              <div className="brand">
                <span>AI ENTERPRISE STUDIO</span>
                <span className="dash" aria-hidden />
              </div>
              <ThemeToggle variant="studio" />
            </header>

            <div className="hero">
              <div className="blob a" />
              <div className="blob b" />
              <div>
                <span className="eyebrow">{eyebrow}</span>
                <h1 className="title">{title}</h1>
                <p className="lede">
                  {product.description ||
                    product.shortDescription ||
                    "Build and operate a consulting agency with guided workflows and human review."}
                </p>
                <div className="feats">
                  {FEATURES.map((f) => (
                    <div key={f.label} className="feat">
                      <span className="ic">{f.svg}</span>
                      <span className="tx">{f.label}</span>
                    </div>
                  ))}
                </div>
                <div className="btnrow" style={{ marginTop: 22 }}>
                  <button type="button" className="btn primary" disabled>
                    View Workflows <span aria-hidden>↓</span>
                  </button>
                </div>
              </div>
              <div className="gen">
                <div className="ghead">
                  <span className="chip">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                      <rect x="10" y="10" width="4" height="4" />
                      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
                    </svg>
                  </span>
                  <h3>GENERATE {wfCount} CUSTOM AGENCY WORKFLOWS</h3>
                </div>
                <p>
                  Choose the AI you work with, set up your agency profile and add client context — the
                  system builds customized workflows for setup, delivery, reporting and growth.
                </p>
                <div className="rule" />
                <div className="big">
                  <b>{wfCount}</b>
                  <span>GUIDED WORKFLOWS</span>
                </div>
              </div>
              <div className="deco" />
            </div>

            <div className="card locked-agency-readonly">
              <div className="chead">
                <span className="ic">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="4" width="14" height="17" rx="2" />
                    <path d="M9 2h6v4H9zM9 11h6M9 15h6" />
                  </svg>
                </span>
                <div>
                  <h2>Agency Configuration</h2>
                  <div className="sub">
                    Choose your AI platform and define the agency profile used across every workflow.
                  </div>
                </div>
                <div className="right" />
              </div>

              <div className="sect">
                <h4>AI platform</h4>
                <div className="hint">The copy-and-open action on every workflow will match this choice.</div>
                <div className="field mini">
                  <label htmlFor="previewPlatform">Which AI will you use?</label>
                  <select id="previewPlatform" disabled defaultValue="ChatGPT">
                    <option>ChatGPT</option>
                    <option>Claude</option>
                    <option>Gemini</option>
                  </select>
                </div>
              </div>

              {services.length > 0 ? (
                <div className="sect">
                  <h4>Services included ({services.length})</h4>
                  <div className="hint">Available in the full workspace after purchase.</div>
                  <div className="locked-agency-service-grid" style={{ marginTop: 12 }}>
                    {services.map((s) => (
                      <article key={s.id} className="locked-agency-service-card">
                        <strong>{s.title}</strong>
                        {s.description ? <p>{s.description}</p> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="locked-agency-sales-frame locked-agency-sales-frame-full">
          <div className="locked-agency-sales-toolbar">
            <span>Sales page preview</span>
            <span className="locked-agency-pill">PREVIEW</span>
          </div>
          <iframe
            key={`sales-preview-${product.slug}`}
            title={`${product.name} sales page preview`}
            src={`/sales/${encodeURIComponent(product.slug)}?embed=1`}
            className="locked-agency-sales-iframe"
          />
        </div>
      )}
    </div>
  );
}
