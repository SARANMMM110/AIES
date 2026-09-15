"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch } from "@/lib/api";
import "./reseller.css";

type Dashboard = {
  stats: {
    offers: number;
    publishedOffers: number;
    customers: number;
    sales: number;
    paidSales: number;
    pendingSales: number;
    salesVolumeCents: number;
    savedAgencies: number;
    publishedAgencies: number;
    inquiries: number;
    views: number;
  };
  recentSales: Array<{
    id: string;
    code: string;
    status: string;
    amountCents: number;
    currency: string;
    offer: { title: string };
    customer: { email: string };
  }>;
  recentCustomers: Array<{ id: string; email: string; firstName: string; lastName: string }>;
  topOffers: Array<{ offerId: string; title: string; paidSales: number; volumeCents: number }>;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function ResellerPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Dashboard>("/api/reseller/me")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Reseller"
          subtitle="Your resale statistics. Inquiry volume is not AES revenue."
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          {!data ? <div className="panel muted">Loading dashboard…</div> : null}
          {data ? (
            <div className="stack-lg">
              <section className="reseller-grid">
                <article className="reseller-stat"><span>Saved agencies</span><strong>{data.stats.savedAgencies}</strong></article>
                <article className="reseller-stat"><span>Published agencies</span><strong>{data.stats.publishedAgencies}</strong></article>
                <article className="reseller-stat"><span>Inquiries</span><strong>{data.stats.inquiries}</strong></article>
                <article className="reseller-stat"><span>Page views</span><strong>{data.stats.views}</strong></article>
                <article className="reseller-stat"><span>Offers</span><strong>{data.stats.offers}</strong></article>
                <article className="reseller-stat"><span>Published offers</span><strong>{data.stats.publishedOffers}</strong></article>
                <article className="reseller-stat"><span>Customers</span><strong>{data.stats.customers + data.stats.inquiries}</strong></article>
                <article className="reseller-stat"><span>Paid sales</span><strong>{data.stats.paidSales}</strong></article>
              </section>
              <p className="reseller-note">Recorded sales volume {money(data.stats.salesVolumeCents)}. New agency pages collect inquiries by email and do not take payment.</p>
              <div className="reseller-layout">
                <section className="reseller-card">
                  <p className="reseller-kicker">Recent</p>
                  <h2>Sales</h2>
                  {data.recentSales.length === 0 ? <p className="reseller-meta">No sales yet.</p> : null}
                  <ul className="reseller-list">
                    {data.recentSales.map((sale) => (
                      <li key={sale.id}>
                        <div>
                          <strong>{sale.offer.title}</strong>
                          <span className="reseller-meta">{sale.customer.email} · {sale.status} · {money(sale.amountCents, sale.currency)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="reseller-card">
                  <p className="reseller-kicker">Recent</p>
                  <h2>Customers</h2>
                  {data.recentCustomers.length === 0 ? <p className="reseller-meta">No customers yet.</p> : null}
                  <ul className="reseller-list">
                    {data.recentCustomers.map((customer) => (
                      <li key={customer.id}>
                        <div>
                          <strong>{customer.firstName} {customer.lastName}</strong>
                          <span className="reseller-meta">{customer.email}</span>
                        </div>
                        <Link href={`/reseller/customers/${customer.id}`}>View</Link>
                      </li>
                    ))}
                  </ul>
                  {data.topOffers.length ? (
                    <>
                      <h2>Top offers</h2>
                      <ul className="reseller-list">
                        {data.topOffers.map((offer) => (
                          <li key={offer.offerId}>
                            <div>
                              <strong>{offer.title}</strong>
                              <span className="reseller-meta">{offer.paidSales} paid · {money(offer.volumeCents)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
