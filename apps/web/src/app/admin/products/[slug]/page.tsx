"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { flashToast } from "@/components/Toast";
import { ApiClientError, apiFetch, getClientApiBase, getToken } from "@/lib/api";
import { formatMoney } from "@/lib/purchase";

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  shortDescription?: string | null;
  workflowCount?: number;
  icon?: string | null;
};

type PreviewMode = "agency" | "sales";
type DownloadKind = "sales" | "agency";

async function downloadProductHtml(slug: string, kind: DownloadKind) {
  const token = getToken();
  if (!token) throw new Error("Sign in required");
  const path =
    kind === "sales"
      ? `/api/products/${encodeURIComponent(slug)}/export/sales-page?format=json`
      : `/api/products/${encodeURIComponent(slug)}/export/standalone?format=json`;
  const res = await fetch(`${getClientApiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { html?: string };
    error?: { message?: string };
  };
  if (!res.ok || !json.success || !json.data?.html) {
    throw new ApiClientError(json.error?.message || "Download failed", res.status);
  }
  const filename = kind === "sales" ? `${slug}-sales-page.html` : `${slug}-agency.html`;
  const blob = new Blob([json.data.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminProductViewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>("agency");
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ product: ProductDetail }>(
          `/api/products/${encodeURIComponent(slug)}`
        );
        if (!cancelled) setProduct(data.product);
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setError(err instanceof Error ? err.message : "Failed to load product");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function downloadHtml(kind: DownloadKind) {
    if (!product) return;
    setDownloading(kind);
    try {
      await downloadProductHtml(product.slug, kind);
      flashToast(
        kind === "sales" ? "Sales page HTML downloaded." : "Agency page HTML downloaded.",
        "success"
      );
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error ? err.message : "Download failed";
      flashToast(message, "error");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <Protected adminOnly>
        <AdminShell>
          <ToolLoadingPulse label="Loading product" fullPage={false} />
        </AdminShell>
      </Protected>
    );
  }

  if (error || !product) {
    return (
      <Protected adminOnly>
        <AdminShell>
          <EmptyState
            title="Product not found"
            description={error || "This agency could not be loaded."}
            action={
              <Link className="btn lime" href="/admin/products">
                Back to products
              </Link>
            }
          />
        </AdminShell>
      </Protected>
    );
  }

  const previewSrc = mode === "agency" ? `/products/${product.slug}` : `/sales/${product.slug}`;

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title={product.name}
          subtitle={`${product.slug} · ${formatMoney(product.priceCents, product.currency)} · ${product.status}`}
          actions={
            <Link className="btn ghost" href="/admin/products">
              Back
            </Link>
          }
        />

        <div className="panel" style={{ display: "grid", gap: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className={mode === "agency" ? "btn lime btn-sm" : "btn ghost btn-sm"}
                onClick={() => setMode("agency")}
              >
                Agency page
              </button>
              <button
                type="button"
                className={mode === "sales" ? "btn lime btn-sm" : "btn ghost btn-sm"}
                onClick={() => setMode("sales")}
              >
                Sales page
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
              <button
                type="button"
                className="btn ghost btn-sm"
                disabled={!!downloading}
                onClick={() => void downloadHtml("agency")}
              >
                {downloading === "agency" ? "Downloading…" : "Download agency HTML"}
              </button>
              <button
                type="button"
                className="btn ghost btn-sm"
                disabled={!!downloading}
                onClick={() => void downloadHtml("sales")}
              >
                {downloading === "sales" ? "Downloading…" : "Download sales HTML"}
              </button>
              <a
                className="btn ghost btn-sm"
                href={previewSrc}
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab
              </a>
            </div>
          </div>
          {product.shortDescription ? (
            <p className="muted" style={{ margin: 0 }}>
              {product.shortDescription}
            </p>
          ) : null}
        </div>

        <div
          className="panel"
          style={{
            padding: 0,
            overflow: "hidden",
            minHeight: "70vh",
          }}
        >
          <iframe
            key={previewSrc}
            title={`${product.name} ${mode} preview`}
            src={previewSrc}
            style={{
              display: "block",
              width: "100%",
              height: "min(78vh, 900px)",
              border: 0,
              background: "#fff",
            }}
          />
        </div>
      </AdminShell>
    </Protected>
  );
}
