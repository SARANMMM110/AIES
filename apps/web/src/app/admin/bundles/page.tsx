"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { flashToast } from "@/components/Toast";
import { apiFetch, ApiClientError } from "@/lib/api";
import { formatMoney } from "@/lib/purchase";
import {
  ADMIN_CACHE_KEYS,
  clearAdminCache,
  fetchAdminCached,
  readAdminCache,
  writeAdminCache,
} from "@/lib/admin-list-cache";
import { useClientPagination } from "@/hooks/useClientPagination";

type BundleRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  productCount: number;
  thumbnailUrl?: string | null;
  icon?: string | null;
};

type BundlesPayload = { bundles: BundleRow[] };

export default function AdminBundlesPage() {
  const cached = readAdminCache<BundlesPayload>(ADMIN_CACHE_KEYS.bundles);
  const [bundles, setBundles] = useState<BundleRow[]>(cached?.bundles ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pager = useClientPagination(bundles);

  async function load(force = false) {
    if (!cached && !bundles.length) setLoading(true);
    try {
      const { data } = await fetchAdminCached<BundlesPayload>(
        ADMIN_CACHE_KEYS.bundles,
        "/api/bundles",
        {
          force,
          onFresh: (fresh) => setBundles(fresh.bundles),
        }
      );
      setBundles(data.bundles);
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load bundles");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish(id: string, on: boolean) {
    const previous = bundles;
    const nextStatus = on ? "ACTIVE" : "DRAFT";
    setBundles((rows) => rows.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)));
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/bundles/${id}/${on ? "publish" : "unpublish"}`, { method: "POST" });
      clearAdminCache(ADMIN_CACHE_KEYS.bundles);
      writeAdminCache(ADMIN_CACHE_KEYS.bundles, {
        bundles: previous.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)),
      });
      flashToast(on ? "Bundle published." : "Bundle unpublished.", "success");
    } catch (err) {
      setBundles(previous);
      const message = err instanceof ApiClientError ? err.message : "Update failed";
      setError(message);
      flashToast(message, "error");
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
      flashToast("Bundle duplicated.", "success");
      window.location.href = `/admin/bundles/${data.bundle.id}`;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Duplicate failed";
      setError(message);
      flashToast(message, "error");
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this bundle? Historical purchases are preserved.")) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/bundles/${id}`, { method: "DELETE" });
      clearAdminCache(ADMIN_CACHE_KEYS.bundles);
      await load(true);
      flashToast("Bundle archived.", "success");
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Archive failed";
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
          {loading ? (
            <ToolLoadingPulse label="Loading bundles" fullPage={false} />
          ) : bundles.length === 0 ? (
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
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {b.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={b.thumbnailUrl}
                              alt=""
                              width={44}
                              height={28}
                              style={{
                                width: 44,
                                height: 28,
                                objectFit: "cover",
                                borderRadius: 6,
                                border: "1px solid var(--border, #d5ddd8)",
                                flexShrink: 0,
                              }}
                            />
                          ) : b.icon ? (
                            <span
                              aria-hidden
                              style={{
                                width: 44,
                                height: 28,
                                display: "grid",
                                placeItems: "center",
                                borderRadius: 6,
                                background: "var(--panel-soft, #eef2ef)",
                                fontSize: 14,
                                flexShrink: 0,
                              }}
                            >
                              {b.icon}
                            </span>
                          ) : null}
                          <strong title={b.slug}>{b.name}</strong>
                        </div>
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
