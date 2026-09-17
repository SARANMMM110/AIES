"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { flashToast } from "@/components/Toast";
import { apiFetch } from "@/lib/api";
import { useClientPagination } from "@/hooks/useClientPagination";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

type ProductOpt = { id: string; name: string; slug: string; status?: string };
type BundleOpt = { id: string; name: string; slug: string };

type AccessPayload = {
  productAccess: Array<{
    id: string;
    status: string;
    source: string;
    product: { id: string; name: string; slug: string };
    bundle: { id: string; name: string; slug: string } | null;
  }>;
  bundleAccess: Array<{
    id: string;
    status: string;
    bundle: { id: string; name: string; slug: string; status: string };
  }>;
  purchases: Array<{
    id: string;
    status: string;
    createdAt: string;
    code?: string;
  }>;
};

function AdminUserAccessInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const userId = params.id;
  const inquiryId = search.get("inquiryId") || "";
  const prefillProductId = search.get("productId") || "";
  const prefillBundleId = search.get("bundleId") || "";

  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [bundles, setBundles] = useState<BundleOpt[]>([]);
  const [productId, setProductId] = useState(prefillProductId);
  const [bundleId, setBundleId] = useState(prefillBundleId);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const productAccessPager = useClientPagination(access?.productAccess || []);
  const bundleAccessPager = useClientPagination(access?.bundleAccess || []);

  async function markInquiryContacted() {
    if (!inquiryId) return;
    try {
      await apiFetch(`/api/sales/inquiries/${inquiryId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CONTACTED" }),
      });
    } catch {
      // Access grant succeeded; inquiry status is secondary
    }
  }

  async function load() {
    const [userRes, accessRes, productList, bundleList] = await Promise.all([
      apiFetch<{ user: User }>(`/api/users/${userId}`),
      apiFetch<AccessPayload>(`/api/access/admin/users/${userId}`),
      apiFetch<{ products: ProductOpt[] }>("/api/products"),
      apiFetch<{ bundles: BundleOpt[] }>("/api/bundles"),
    ]);
    setUser(userRes.user);
    setAccess(accessRes);
    const liveProducts = (productList.products || []).filter((p) => p.status !== "ARCHIVED");
    setProducts(liveProducts);
    setBundles(bundleList.bundles || []);

    setProductId((current) => {
      if (prefillProductId && liveProducts.some((p) => p.id === prefillProductId)) return prefillProductId;
      if (current && liveProducts.some((p) => p.id === current)) return current;
      return liveProducts[0]?.id || "";
    });
    setBundleId((current) => {
      if (prefillBundleId && (bundleList.bundles || []).some((b) => b.id === prefillBundleId)) {
        return prefillBundleId;
      }
      if (current && (bundleList.bundles || []).some((b) => b.id === current)) return current;
      return bundleList.bundles?.[0]?.id || "";
    });
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function grantProduct(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/access/products/grant", {
        method: "POST",
        body: JSON.stringify({ userId, productId, source: "ADMIN_GRANT" }),
      });
      await markInquiryContacted();
      setNotice("Agency enabled for this customer. It will appear on their Products page.");
      flashToast("Agency enabled for this customer.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Grant failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function grantBundle(e: FormEvent) {
    e.preventDefault();
    if (!bundleId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/access/bundles/grant", {
        method: "POST",
        body: JSON.stringify({ userId, bundleId, source: "ADMIN_GRANT" }),
      });
      await markInquiryContacted();
      setNotice("Bundle enabled for this customer.");
      flashToast("Bundle enabled for this customer.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Grant failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revokeProduct(accessId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/access/products/${accessId}/revoke`, { method: "POST" });
      flashToast("Agency access revoked.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Revoke failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revokeBundle(accessId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/access/bundles/${accessId}/revoke`, { method: "POST" });
      flashToast("Bundle access revoked.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Revoke failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  const requestedName =
    products.find((p) => p.id === prefillProductId)?.name ||
    bundles.find((b) => b.id === prefillBundleId)?.name ||
    null;

  return (
    <>
      <PageHeader
        title={user ? `${user.firstName} ${user.lastName}` : "Customer access"}
        subtitle={user ? user.email : "Enable agencies for this customer."}
        actions={
          <div className="reseller-actions">
            {inquiryId ? (
              <Link className="btn ghost" href="/admin/inquiries">
                Back to inquiries
              </Link>
            ) : null}
            <Link className="btn ghost" href="/admin/users">
              Back to users
            </Link>
          </div>
        }
      />
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      {user ? (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <div className="reseller-actions">
            <StatusBadge status={user.role} />
            <span className="muted">{user.isActive ? "Active" : "Inactive"}</span>
            {inquiryId ? (
              <span className="muted">
                From inquiry{requestedName ? ` · enable ${requestedName}` : ""}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="stack-lg">
        <section className="panel">
          <div className="section-heading">
            <h2>Agency access</h2>
          </div>
          <form className="reseller-filters" onSubmit={(e) => void grantProduct(e)}>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <button className="btn lime" type="submit" disabled={busy || !productId}>
              Enable agency
            </button>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Source</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {productAccessPager.pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.product.name}</td>
                  <td>
                    {row.source}
                    {row.bundle ? ` · ${row.bundle.name}` : ""}
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>
                    {row.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className="btn btn-sm ghost"
                        disabled={busy}
                        onClick={() => void revokeProduct(row.id)}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={productAccessPager.page}
            totalPages={productAccessPager.totalPages}
            total={productAccessPager.total}
            pageSize={productAccessPager.pageSize}
            show={productAccessPager.showPagination}
            onPageChange={productAccessPager.setPage}
          />
          {!access?.productAccess?.length ? <p className="muted">No agencies enabled yet.</p> : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <h2>Bundle access</h2>
          </div>
          <form className="reseller-filters" onSubmit={(e) => void grantBundle(e)}>
            <select value={bundleId} onChange={(e) => setBundleId(e.target.value)}>
              {bundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.name}
                </option>
              ))}
            </select>
            <button className="btn lime" type="submit" disabled={busy || !bundleId}>
              Enable bundle
            </button>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>Bundle</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bundleAccessPager.pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.bundle.name}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>
                    {row.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className="btn btn-sm ghost"
                        disabled={busy}
                        onClick={() => void revokeBundle(row.id)}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={bundleAccessPager.page}
            totalPages={bundleAccessPager.totalPages}
            total={bundleAccessPager.total}
            pageSize={bundleAccessPager.pageSize}
            show={bundleAccessPager.showPagination}
            onPageChange={bundleAccessPager.setPage}
          />
        </section>
      </div>
    </>
  );
}

export default function AdminUserAccessPage() {
  return (
    <Protected adminOnly>
      <AdminShell>
        <Suspense fallback={<div className="panel muted">Loading access…</div>}>
          <AdminUserAccessInner />
        </Suspense>
      </AdminShell>
    </Protected>
  );
}
