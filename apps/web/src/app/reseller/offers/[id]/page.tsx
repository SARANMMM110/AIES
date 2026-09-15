"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch } from "@/lib/api";
import "../../reseller.css";

type Offer = {
  id: string;
  title: string;
  description: string | null;
  ctaText: string | null;
  priceCents: number;
  currency: string;
  status: string;
  entitlementId: string;
};

const OFFER_NOTICE_KEY = "resellerOfferNotice";

export default function EditOfferPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<Offer[]>("/api/reseller/offers")
      .then((rows) => setOffer(rows.find((row) => row.id === params.id) ?? null))
      .catch((err: Error) => setError(err.message));
  }, [params.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/reseller/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: offer.title,
          description: offer.description,
          ctaText: offer.ctaText,
          currency: offer.currency,
          priceCents: offer.priceCents,
        }),
      });
      sessionStorage.setItem(OFFER_NOTICE_KEY, "Offer saved.");
      router.push("/reseller/offers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save offer");
      setBusy(false);
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader title="Edit offer" subtitle="Price changes do not rewrite historical sales." />
        <ResellerGate>
          <ResellerNav />
          {!offer ? <div className="panel muted">{error || "Loading offer…"}</div> : null}
          {offer ? (
            <form className="reseller-card reseller-form" onSubmit={(e) => void onSubmit(e)}>
              {error ? <p className="error">{error}</p> : null}
              <label>
                Offer name
                <input value={offer.title} onChange={(e) => setOffer({ ...offer, title: e.target.value })} required />
              </label>
              <label>
                Description
                <textarea rows={3} value={offer.description || ""} onChange={(e) => setOffer({ ...offer, description: e.target.value })} />
              </label>
              <label>
                Resale price (cents)
                <input type="number" min={100} value={offer.priceCents} onChange={(e) => setOffer({ ...offer, priceCents: Number(e.target.value) })} required />
              </label>
              <label>
                Currency
                <input value={offer.currency} maxLength={3} onChange={(e) => setOffer({ ...offer, currency: e.target.value.toUpperCase() })} />
              </label>
              <label>
                Button text
                <input value={offer.ctaText || ""} onChange={(e) => setOffer({ ...offer, ctaText: e.target.value })} />
              </label>
              <div className="reseller-actions">
                <button className="btn lime" type="submit" disabled={busy}>Save</button>
                <Link href={`/reseller/offers/${offer.id}/preview`}>Preview</Link>
              </div>
            </form>
          ) : null}
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
