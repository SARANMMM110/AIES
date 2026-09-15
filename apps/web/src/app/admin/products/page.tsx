"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch, ApiClientError } from "@/lib/api";
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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { price: string; currency: string; status: string }>
  >({});
  const pager = useClientPagination(products);

  async function load() {
    const data = await apiFetch<{ products: ProductRow[] }>("/api/products");
    setProducts(data.products);
    const next: typeof drafts = {};
    for (const p of data.products) {
      next[p.id] = {
        price: p.priceCents == null ? "" : String(p.priceCents / 100),
        currency: p.currency || "USD",
        status: p.status,
      };
    }
    setDrafts(next);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load products")
    );
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
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Products"
          subtitle="Manage agency pricing, currency, and publish state."
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          {products.length === 0 ? (
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
                            placeholder="299"
                            aria-label={`${product.name} price`}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: 52 }}
                            maxLength={3}
                            value={draft.currency}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [product.id]: {
                                  ...draft,
                                  currency: e.target.value.toUpperCase(),
                                },
                              }))
                            }
                            aria-label={`${product.name} currency`}
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
                            aria-label={`${product.name} status`}
                          >
                            <option value="PUBLISHED">Published</option>
                            <option value="DRAFT">Draft</option>
                            <option value="ARCHIVED">Archived</option>
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
                              href={`/sales/${product.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Preview
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
