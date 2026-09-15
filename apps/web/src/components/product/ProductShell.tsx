"use client";

import { useState } from "react";
import Link from "next/link";
import { ExportActions } from "./ExportActions";
import { useNavigateBack } from "@/hooks/useNavigateBack";
import "@/app/agency-studio.css";

export function displayAgencyName(name: string): string {
  return name.replace(/\s+Agency$/i, "");
}

export type ProductViewMode = "workspace" | "sales";

/**
 * Layout matching the product preview frame:
 * 1. Slim white header — Back + brand + Workspace/Sales Page
 * 2. Cream rounded tool frame (workspace, or owned sales page with download)
 */
export function ProductShell({
  slug,
  accent = "#caff45",
  children,
}: {
  slug: string;
  productName?: string;
  category?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<ProductViewMode>("workspace");
  const goBack = useNavigateBack("/products");

  return (
    <div
      className="agency-studio"
      style={{ ["--agency-accent" as string]: accent }}
    >
      <div className="studio-header-fixed">
      <header className="page-header" role="banner">
        <div className="page-header-left">
          <button type="button" className="page-back" aria-label="Go back" onClick={goBack}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <Link href="/dashboard" className="page-header-brand">
            AI ENTERPRISE STUDIO
          </Link>
          <nav className="page-header-menu" aria-label="Product views">
            <button
              type="button"
              className={view === "workspace" ? "page-menu-item active" : "page-menu-item"}
              aria-pressed={view === "workspace"}
              onClick={() => setView("workspace")}
            >
              Workspace
            </button>
            <button
              type="button"
              className={view === "sales" ? "page-menu-item active" : "page-menu-item"}
              aria-pressed={view === "sales"}
              onClick={() => setView("sales")}
            >
              Sales Page
            </button>
          </nav>
        </div>
        <div className="page-header-actions">
          {view === "workspace" ? (
            <ExportActions slug={slug} variant="page-header" exportKind="standalone" />
          ) : (
            <ExportActions slug={slug} variant="page-header" exportKind="sales-page" />
          )}
          <Link className="page-header-link" href="/products">
            My Products
          </Link>
          <Link className="page-header-link page-header-link-accent" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </header>
      </div>

      <section
        className={view === "sales" ? "tool-preview tool-preview-sales" : "tool-preview"}
        aria-label={view === "sales" ? "Sales page" : "Tool preview"}
      >
        {view === "sales" ? <AgencySalesPreview slug={slug} /> : children}
      </section>
    </div>
  );
}

function AgencySalesPreview({ slug }: { slug: string }) {
  return (
    <div className="sales-preview-frame">
      <iframe
        title={`${slug} sales page`}
        className="sales-preview-iframe"
        src={`/sales/${slug}?frame=1`}
      />
    </div>
  );
}
