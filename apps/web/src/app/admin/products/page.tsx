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
import { apiFetch, ApiClientError } from "@/lib/api";
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

export default function AdminProductsPage() {
  const cached = readAdminCache<ProductsPayload>(ADMIN_CACHE_KEYS.products);
  const [products, setProducts] = useState<ProductRow[]>(cached?.products ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Products"
          subtitle="Manage agency pricing, currency, and publish state. Open View to preview pages and download HTML."
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
                          <div className="row-actions">
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
                              href={`/admin/products/${product.slug}`}
                            >
                              View
                            </Link>
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
