"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Protected } from "@/components/Protected";
import { useNavigateBack } from "@/hooks/useNavigateBack";
import { apiFetch } from "@/lib/api";
import "../../../reseller.css";

type Preview = {
  title: string;
  description: string | null;
  salesCopy: string | null;
  ctaText: string;
  priceCents: number;
  currency: string;
  status: string;
  attribution: string;
  brand: { brandName: string | null; logoUrl: string | null; primaryColor: string | null; supportEmail: string | null } | null;
  products: Array<{ name: string; shortDescription: string | null; services: string[] }>;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function OfferPreviewPage() {
  const params = useParams<{ id: string }>();
  const goBack = useNavigateBack(`/reseller/offers/${params.id}`);
  const [offer, setOffer] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Preview>(`/api/reseller/offers/${params.id}/preview`)
      .then(setOffer)
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  return (
    <Protected>
      <div className="reseller-public" style={{ ["--brand" as string]: offer?.brand?.primaryColor || "#c8f04d" }}>
        <div className="reseller-preview-bar">
          <button type="button" className="reseller-back" onClick={goBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
          <p className="reseller-note">Preview only. This does not create a sale, customer, or payment.</p>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {offer ? (
          <div className="reseller-public-card">
            <p className="reseller-kicker">{offer.brand?.brandName || "Your offer"}</p>
            <h1>{offer.title}</h1>
            <p>{offer.salesCopy || offer.description}</p>
            <p><strong>{money(offer.priceCents, offer.currency)}</strong> · {offer.status}</p>
            <ul className="reseller-list">
              {offer.products.map((product) => (
                <li key={product.name}>
                  <div>
                    <strong>{product.name}</strong>
                    <span className="reseller-meta">{product.services.join(" · ")}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button className="btn lime" type="button" disabled>{offer.ctaText}</button>
            <p className="reseller-note">{offer.attribution}</p>
          </div>
        ) : null}
      </div>
    </Protected>
  );
}
