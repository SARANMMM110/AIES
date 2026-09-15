"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch, ApiClientError } from "@/lib/api";
import { formatMoney } from "@/lib/purchase";
import { useClientPagination } from "@/hooks/useClientPagination";

type BundleRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  productCount: number;
};

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pager = useClientPagination(bundles);

  async function load() {
    const data = await apiFetch<{ bundles: BundleRow[] }>("/api/bundles");
    setBundles(data.bundles);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load bundles")
    );
  }, []);

  async function publish(id: string, on: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/bundles/${id}/${on ? "publish" : "unpublish"}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const data = await apiFetch<{ bundle: BundleRow }>(`/api/bundles/${id}/duplicate`, {
        method: "POST",
      });
      window.location.href = `/admin/bundles/${data.bundle.id}`;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Duplicate failed");
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this bundle? Historical purchases are preserved.")) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/bundles/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Archive failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Bundles"
          subtitle="Create packs from the 10 agencies. Publish to show on the sales catalog."
          actions={
            <Link className="btn lime btn-sm" href="/admin/bundles/new">
              Create bundle
            </Link>
          }
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          {bundles.length === 0 ? (
            <EmptyState title="No bundles yet." description="Create a pack from approved agencies." />
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Products</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong title={b.slug}>{b.name}</strong>
                      </td>
                      <td>{b.productCount}</td>
                      <td>{formatMoney(b.priceCents, b.currency)}</td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn ghost btn-sm" href={`/admin/bundles/${b.id}`}>
                            Edit
                          </Link>
                          <Link
                            className="btn ghost btn-sm"
                            href={`/sales/bundles/${b.slug}`}
                            target="_blank"
                          >
                            Preview
                          </Link>
                          {b.status === "ACTIVE" ? (
                            <button
                              type="button"
                              className="btn ghost btn-sm"
                              disabled={busyId === b.id}
                              onClick={() => void publish(b.id, false)}
                            >
                              Unpublish
                            </button>
                          ) : b.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              className="btn ghost btn-sm"
                              disabled={busyId === b.id}
                              onClick={() => void publish(b.id, true)}
                            >
                              Publish
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn ghost btn-sm"
                            disabled={busyId === b.id}
                            onClick={() => void duplicate(b.id)}
                          >
                            Duplicate
                          </button>
                          {b.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              className="btn ghost btn-sm"
                              disabled={busyId === b.id}
                              onClick={() => void archive(b.id)}
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
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
