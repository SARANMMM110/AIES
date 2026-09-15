"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch } from "@/lib/api";
import { useClientPagination } from "@/hooks/useClientPagination";

type MatchedCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  alreadyHasRequested: boolean;
};

type AesInquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  interest: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  productId: string | null;
  product: { id: string; name: string; slug: string } | null;
  bundle: { id: string; name: string; slug: string; items: Array<{ productId: string }> } | null;
  matchedCustomer: MatchedCustomer | null;
};

type ResellerInquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  createdAt: string;
  interest: string;
  product: string | null;
  resellerEmail: string;
};

function accessHref(row: AesInquiry) {
  const customer = row.matchedCustomer!;
  const params = new URLSearchParams({ inquiryId: row.id });
  if (row.product?.id || row.productId) {
    params.set("productId", row.product?.id || row.productId || "");
  } else if (row.bundle?.id) {
    params.set("bundleId", row.bundle.id);
  }
  return `/admin/users/${customer.id}?${params.toString()}`;
}

function provisionHref(row: AesInquiry) {
  return `/admin/users/provision?${new URLSearchParams({
    inquiryId: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.product?.id || row.productId
      ? { productId: row.product?.id || row.productId || "" }
      : row.bundle?.items?.length
        ? { productIds: row.bundle.items.map((item) => item.productId).join(",") }
        : {}),
  }).toString()}`;
}

export default function AdminInquiriesPage() {
  const [inquiryQ, setInquiryQ] = useState("");
  const [aes, setAes] = useState<AesInquiry[]>([]);
  const [resellerLeads, setResellerLeads] = useState<ResellerInquiry[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const aesPager = useClientPagination(aes, { resetKey: inquiryQ });
  const resellerPager = useClientPagination(resellerLeads, { resetKey: inquiryQ });

  async function load(q = inquiryQ) {
    setError(null);
    try {
      const data = await apiFetch<{
        aes: AesInquiry[];
        reseller: ResellerInquiry[];
        note?: string;
      }>(`/api/sales/inquiries?q=${encodeURIComponent(q)}`);
      setAes(data.aes || []);
      setResellerLeads(data.reseller || []);
      setNote(data.note || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inquiries");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") || "").trim();
    setInquiryQ(q);
    void load(q);
  }

  async function setInquiryStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/sales/inquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load(inquiryQ);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Inquiries"
          subtitle="New purchase requests. Create an account for new leads, or enable agencies for existing customers."
        />
        {error ? <p className="error">{error}</p> : null}
        {note ? <p className="muted">{note}</p> : null}

        <form className="reseller-filters" onSubmit={onSearch}>
          <input name="q" defaultValue={inquiryQ} placeholder="Search name, email, company" />
          <button className="btn btn-sm" type="submit">
            Search
          </button>
        </form>

        <div className="stack">
          <section className="panel">
            <h2 style={{ marginTop: 0 }}>AES sales pages</h2>
            {aes.length === 0 ? (
              <EmptyState title="No AES inquiries yet" description="Purchase form submissions will show here." />
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Interest</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Received</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {aesPager.pageItems.map((row) => {
                      const existing = row.matchedCustomer;
                      return (
                        <tr key={row.id}>
                          <td>
                            <strong>
                              {row.firstName} {row.lastName}
                            </strong>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {row.email}
                              {row.phone ? ` · ${row.phone}` : ""}
                              {row.company ? ` · ${row.company}` : ""}
                            </div>
                          </td>
                          <td>{row.interest || row.product?.name || row.bundle?.name || "—"}</td>
                          <td>
                            {existing ? (
                              <div>
                                <strong>
                                  {existing.firstName} {existing.lastName}
                                </strong>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  Existing customer
                                  {existing.alreadyHasRequested ? " · already has this agency" : " · new enquiry"}
                                </div>
                              </div>
                            ) : (
                              <span className="muted">New lead</span>
                            )}
                          </td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          <td>
                            <div className="reseller-actions">
                              {existing ? (
                                <Link className="btn btn-sm lime" href={accessHref(row)}>
                                  {existing.alreadyHasRequested ? "View access" : "Enable agency"}
                                </Link>
                              ) : (
                                <Link className="btn btn-sm" href={provisionHref(row)}>
                                  Create account
                                </Link>
                              )}
                              {["NEW", "CONTACTED", "CLOSED"].map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className="btn btn-sm ghost"
                                  disabled={row.status === status}
                                  onClick={() => void setInquiryStatus(row.id, status)}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <TablePagination
                  page={aesPager.page}
                  totalPages={aesPager.totalPages}
                  total={aesPager.total}
                  pageSize={aesPager.pageSize}
                  show={aesPager.showPagination}
                  onPageChange={aesPager.setPage}
                />
              </>
            )}
          </section>

          <section className="panel">
            <h2 style={{ marginTop: 0 }}>Reseller leads</h2>
            {resellerLeads.length === 0 ? (
              <EmptyState title="No reseller leads yet" description="Branded page inquiries will show here." />
            ) : (
              <>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Interest</th>
                      <th>Reseller</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellerPager.pageItems.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>
                            {row.firstName} {row.lastName}
                          </strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {row.email}
                            {row.company ? ` · ${row.company}` : ""}
                          </div>
                        </td>
                        <td>
                          {row.interest}
                          {row.product ? ` · ${row.product}` : ""}
                        </td>
                        <td>{row.resellerEmail}</td>
                        <td>{new Date(row.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  page={resellerPager.page}
                  totalPages={resellerPager.totalPages}
                  total={resellerPager.total}
                  pageSize={resellerPager.pageSize}
                  show={resellerPager.showPagination}
                  onPageChange={resellerPager.setPage}
                />
              </>
            )}
          </section>
        </div>
      </AdminShell>
    </Protected>
  );
}
