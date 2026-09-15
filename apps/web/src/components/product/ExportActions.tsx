"use client";

import { useState } from "react";
import { ApiClientError, getToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ExportKind = "standalone" | "sales-page";

export function ExportActions({
  slug,
  compact = false,
  variant = "default",
  exportKind = "standalone",
}: {
  slug: string;
  compact?: boolean;
  /** page-header: lime Download only; product-bar: Open + Download */
  variant?: "default" | "product-bar" | "page-header";
  /** When sales-page, Download exports the agency sales page HTML */
  exportKind?: ExportKind;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchHtml(): Promise<{ html: string; filename: string }> {
    const token = getToken();
    if (!token) throw new Error("Sign in required to export");
    const path =
      exportKind === "sales-page"
        ? `${API_URL}/api/products/${slug}/export/sales-page?format=json`
        : `${API_URL}/api/products/${slug}/export/standalone?format=json`;
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new ApiClientError(
        json.error?.message || "Export failed",
        res.status,
        json.error?.code
      );
    }
    return {
      html: json.data.html as string,
      filename:
        exportKind === "sales-page" ? `${slug}-sales-page.html` : `${slug}.html`,
    };
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { html, filename } = await fetchHtml();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function openInBrowser() {
    setBusy(true);
    setError(null);
    try {
      const { html } = await fetchHtml();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) setError("Popup blocked");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const downloadLabel =
    exportKind === "sales-page"
      ? busy
        ? "Downloading…"
        : "Download HTML"
      : busy
        ? "Downloading…"
        : "Download";

  if (variant === "page-header" || variant === "product-bar") {
    return (
      <div className="product-bar-actions">
        {variant === "product-bar" ? (
          <button
            type="button"
            className="open-btn"
            disabled={busy}
            onClick={() => void openInBrowser()}
          >
            Open in Browser
          </button>
        ) : null}
        <button
          type="button"
          className="download-btn"
          disabled={busy}
          onClick={() => void download()}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {downloadLabel}
        </button>
        {error ? (
          <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="header-link"
          disabled={busy}
          onClick={() => void openInBrowser()}
        >
          Open
        </button>
        <button
          type="button"
          className="header-link"
          disabled={busy}
          onClick={() => void download()}
        >
          {busy ? "…" : "HTML"}
        </button>
        {error ? (
          <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>
        ) : null}
      </>
    );
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        type="button"
        className="btn ghost"
        disabled={busy}
        onClick={() => void openInBrowser()}
      >
        Open in Browser
      </button>
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Exporting…" : exportKind === "sales-page" ? "Download Sales HTML" : "Download HTML"}
      </button>
    </div>
  );
}
