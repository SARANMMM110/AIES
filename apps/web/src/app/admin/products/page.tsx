"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { flashToast } from "@/components/Toast";
import { apiFetch, ApiClientError, getClientApiBase, getToken } from "@/lib/api";
import {
  ADMIN_CACHE_KEYS,
  clearAdminCache,
  fetchAdminCached,
  readAdminCache,
} from "@/lib/admin-list-cache";
import { useClientPagination } from "@/hooks/useClientPagination";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  workflowCount?: number;
}

type ProductsPayload = { products: ProductRow[] };
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

export default function AdminProductsPage() {
  const cached = readAdminCache<ProductsPayload>(ADMIN_CACHE_KEYS.products);
  const [products, setProducts] = useState<ProductRow[]>(cached?.products ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadKey, setDownloadKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { price: string; currency: string; status: string }>
  >({});
  const pager = useClientPagination(products);

  function applyProducts(list: ProductRow[]) {
    setProducts(list);
    const next: Record<string, { price: string; currency: string; status: string }> = {};
    for (const p of list) {
      next[p.id] = {
        price: p.priceCents == null ? "" : String(p.priceCents / 100),
        currency: p.currency || "USD",
        status: p.status,
      };
    }
    setDrafts(next);
  }

  async function load(force = false) {
    if (!cached && !products.length) setLoading(true);
    try {
      const { data } = await fetchAdminCached<ProductsPayload>(
        ADMIN_CACHE_KEYS.products,
        "/api/products",
        {
          force,
          onFresh: (fresh) => applyProducts(fresh.products),
        }
      );
      applyProducts(data.products);
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cached) applyProducts(cached.products);
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(product: ProductRow) {
    const draft = drafts[product.id];
    if (!draft) return;
    setBusyId(product.id);
    setError(null);
    try {
      const priceCents =
        draft.price.trim() === "" ? null : Math.round(Number(draft.price) * 100);
      if (priceCents != null && (Number.isNaN(priceCents) || priceCents < 0)) {
        throw new Error("Invalid price");
      }
      await apiFetch(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          priceCents,
          currency: draft.currency.toUpperCase().slice(0, 3),
          status: draft.status,
        }),
      });
      clearAdminCache(ADMIN_CACHE_KEYS.products);
      await load(true);
      flashToast("Product saved.", "success");
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error ? err.message : "Save failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadHtml(product: ProductRow, kind: DownloadKind) {
    const key = `${product.id}:${kind}`;
    setDownloadKey(key);
    setError(null);
    try {
      await downloadProductHtml(product.slug, kind);
      flashToast(
        kind === "sales" ? "Sales page HTML downloaded." : "Agency page HTML downloaded.",
        "success"
      );
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error ? err.message : "Download failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setDownloadKey(null);
    }
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Products"
          subtitle="Manage agency pricing, currency, and publish state. Open or download the sales page and agency page for each product."
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          {loading ? (
            <ToolLoadingPulse label="Loading products" fullPage={false} />
          ) : products.length === 0 ? (
            <EmptyState title="No products yet." description="Seed or create a product to begin." />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Workflows</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((product) => {
                    const draft = drafts[product.id] ?? {
                      price: "",
                      currency: "USD",
                      status: product.status,
                    };
                    const salesBusy = downloadKey === `${product.id}:sales`;
                    const agencyBusy = downloadKey === `${product.id}:agency`;
                    return (
                      <tr key={product.id}>
                        <td>
                          <strong title={product.slug}>{product.name}</strong>
                        </td>
                        <td>
                          <input
                            style={{ width: 72 }}
                            value={draft.price}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...draft, price: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 64 }}
                            value={draft.currency}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...draft, currency: e.target.value },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [product.id]: { ...draft, status: e.target.value },
                              }))
                            }
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="PUBLISHED">PUBLISHED</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                          </select>
                        </td>
                        <td>{product.workflowCount ?? 0}</td>
                        <td>
                          <div className="row-actions" style={{ flexWrap: "wrap", maxWidth: 420 }}>
                            <button
                              type="button"
                              className="btn lime btn-sm"
                              disabled={busyId === product.id}
                              onClick={() => void save(product)}
                            >
                              {busyId === product.id ? "Saving…" : "Save"}
                            </button>
                            <Link
                              className="btn ghost btn-sm"
                              href={`/sales/${product.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Sales page
                            </Link>
                            <Link
                              className="btn ghost btn-sm"
                              href={`/products/${product.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Agency page
                            </Link>
                            <button
                              type="button"
                              className="btn ghost btn-sm"
                              disabled={!!downloadKey}
                              onClick={() => void downloadHtml(product, "sales")}
                            >
                              {salesBusy ? "…" : "Sales HTML"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost btn-sm"
                              disabled={!!downloadKey}
                              onClick={() => void downloadHtml(product, "agency")}
                            >
                              {agencyBusy ? "…" : "Agency HTML"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <TablePagination
                page={pager.page}
                totalPages={pager.totalPages}
                total={pager.total}
                pageSize={pager.pageSize}
                show={pager.showPagination}
                onPageChange={pager.setPage}
              />
            </>
          )}
        </div>
      </AdminShell>
    </Protected>
  );
}
