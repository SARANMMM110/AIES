"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch } from "@/lib/api";
import { useClientPagination } from "@/hooks/useClientPagination";
import "../reseller.css";

type Customer = {
  id: string;
  kind?: "sale" | "inquiry";
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone?: string | null;
  message?: string | null;
  status: string;
  agency?: string | null;
  offer: string | null;
  product: string | null;
  pageTitle?: string | null;
  saleStatus: string | null;
  accessStatus: string;
  purchasedAt: string | null;
};

function agencyLabel(row: Customer) {
  return row.agency || row.product || row.pageTitle || null;
}

export default function ResellerCustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pager = useClientPagination(customers ?? []);

  useEffect(() => {
    void apiFetch<Customer[]>("/api/reseller/customers")
      .then(setCustomers)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Customers"
          subtitle="Sales customers and people who sent purchase details from a branded agency sales page."
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          <section className="reseller-card">
            {!customers ? <p className="reseller-meta">Loading customers…</p> : null}
            {customers && customers.length === 0 ? <p className="reseller-meta">No customers yet.</p> : null}
            {customers && customers.length > 0 ? (
              <>
                <table className="reseller-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Enquiry for agency</th>
                      <th>Offer</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.pageItems.map((customer) => {
                      const agency = agencyLabel(customer);
                      return (
                        <tr key={customer.id}>
                          <td>
                            <Link href={`/reseller/customers/${customer.id}`}>
                              {customer.firstName} {customer.lastName}
                            </Link>
                          </td>
                          <td>
                            {customer.email}
                            {customer.phone ? ` · ${customer.phone}` : ""}
                          </td>
                          <td>
                            {agency ? (
                              <>
                                <strong>{agency}</strong>
                                {customer.kind === "inquiry" ? (
                                  <div className="reseller-meta">Purchase enquiry</div>
                                ) : null}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{customer.offer || "—"}</td>
                          <td>{customer.message || customer.company || "—"}</td>
                          <td>{customer.saleStatus || customer.status}</td>
                          <td>
                            {customer.purchasedAt
                              ? new Date(customer.purchasedAt).toLocaleDateString()
                              : "—"}
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
            ) : null}
          </section>
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
