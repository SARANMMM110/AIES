"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch } from "@/lib/api";
import "../../reseller.css";

type Detail = {
  id: string;
  kind?: "inquiry";
  email: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone?: string | null;
  message?: string | null;
  status: string;
  sales: Array<{
    id: string;
    code: string;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
    paidAt: string | null;
    offer: string;
    product: string | null;
    products: string[];
    accessStatus: string;
  }>;
  inquiry?: { agency: string; product: string | null; offer: string | null; createdAt: string } | null;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Detail>(`/api/reseller/customers/${params.id}`)
      .then(setCustomer)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  return (
    <Protected>
      <AppShell>
        <PageHeader title={customer ? `${customer.firstName} ${customer.lastName}` : "Customer"} subtitle="Use-access only. No reseller rights are shown or granted here." />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          {customer ? (
            <section className="reseller-card">
              <p>{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}{customer.company ? ` · ${customer.company}` : ""} · {customer.status}</p>
              {customer.inquiry ? (
                <div>
                  <p className="reseller-kicker">Purchase enquiry</p>
                  <p>
                    <strong>Enquiry for agency:</strong>{" "}
                    {customer.inquiry.product || customer.inquiry.agency}
                    {customer.inquiry.offer ? ` · Offer: ${customer.inquiry.offer}` : ""}
                  </p>
                  <p>{customer.message || "No message."}</p>
                  <p className="reseller-note">
                    Inquiry only. No payment was taken. Follow up by email. Received{" "}
                    {new Date(customer.inquiry.createdAt).toLocaleString()}.
                  </p>
                </div>
              ) : null}
              <table className="reseller-table">
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Offer</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Access</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.code} · {money(sale.amountCents, sale.currency)}</td>
                      <td>{sale.offer}</td>
                      <td>{sale.products.join(", ") || sale.product || "—"}</td>
                      <td>{sale.status}</td>
                      <td>{sale.accessStatus}</td>
                      <td>{new Date(sale.paidAt || sale.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link href="/reseller/customers">Back to customers</Link>
            </section>
          ) : null}
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
