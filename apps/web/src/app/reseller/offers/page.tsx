"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch } from "@/lib/api";
import "../reseller.css";

type Offer = {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  status: string;
  publicPath: string;
  createdAt: string;
  customers?: number;
  sales?: number;
  products: Array<{ name: string }>;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const OFFER_NOTICE_KEY = "resellerOfferNotice";

export default function ResellerOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setOffers(await apiFetch<Offer[]>("/api/reseller/offers"));
  }

  useEffect(() => {
    const flash = sessionStorage.getItem(OFFER_NOTICE_KEY);
    if (flash) {
      sessionStorage.removeItem(OFFER_NOTICE_KEY);
      setNotice(flash);
    }
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function removeOffer(id: string, title: string) {
    if (!window.confirm(`Delete offer “${title}”? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiFetch(`/api/reseller/offers/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete offer");
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Offers"
          subtitle="Sell agencies you are entitled to resell. Prices are yours, not the AES purchase price."
          actions={<Link className="btn lime" href="/reseller/offers/new">New offer</Link>}
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="success">{notice}</p> : null}
          {offers.length === 0 ? <section className="reseller-card"><p className="reseller-meta">No offers yet.</p></section> : null}
          <div className="reseller-offer-grid">
            {offers.map((offer) => (
              <article className="reseller-card reseller-offer-card" key={offer.id}>
                <div className="reseller-offer-top">
                  <div>
                    <p className="reseller-kicker">{offer.status}</p>
                    <h2>{offer.title}</h2>
                    <p className="reseller-meta">{offer.products.map((product) => product.name).join(", ") || "No agency attached"}</p>
                  </div>
                  <strong>{money(offer.priceCents, offer.currency)}</strong>
                </div>
                <dl className="reseller-metrics">
                  <div><dt>Customers</dt><dd>{offer.customers ?? 0}</dd></div>
                  <div><dt>Sales</dt><dd>{offer.sales ?? 0}</dd></div>
                  <div><dt>Created</dt><dd>{new Date(offer.createdAt).toLocaleDateString()}</dd></div>
                </dl>
                <div className="reseller-actions">
                  <Link className="btn btn-sm" href={`/reseller/offers/${offer.id}`}>Edit</Link>
                  <Link className="btn ghost btn-sm" href={`/reseller/offers/${offer.id}/preview`}>Preview</Link>
                  <button
                    className="btn ghost btn-sm"
                    type="button"
                    onClick={() => void removeOffer(offer.id, offer.title)}
                  >
                    Delete
                  </button>
                  {offer.status === "PUBLISHED" || offer.status === "ACTIVE" ? <Link href={offer.publicPath}>View</Link> : null}
                </div>
              </article>
            ))}
          </div>
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
