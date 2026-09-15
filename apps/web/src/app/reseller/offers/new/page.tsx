"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch } from "@/lib/api";
import "../../reseller.css";

type ProductRef = { id: string; name: string };
type Entitlement = {
  id: string;
  scope: string;
  products: ProductRef[];
  bundle: { name: string } | null;
  product: { name: string } | null;
  policy: { minPriceCents: number | null } | null;
};

const OFFER_NOTICE_KEY = "resellerOfferNotice";

export default function NewOfferPage() {
  const router = useRouter();
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [entitlementId, setEntitlementId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Purchase");
  const [price, setPrice] = useState("599");
  const [currency, setCurrency] = useState("USD");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = entitlements.find((item) => item.id === entitlementId) ?? null;

  useEffect(() => {
    void apiFetch<{ entitlements: Entitlement[] }>("/api/reseller/me")
      .then((data) => {
        setEntitlements(data.entitlements);
        if (data.entitlements[0]) {
          setEntitlementId(data.entitlements[0].id);
          setSelected(data.entitlements[0].products.map((product) => product.id));
        }
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!entitlementId || !selected.length) {
      setError("No resale entitlement is available on this account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ id: string }>("/api/reseller/offers", {
        method: "POST",
        body: JSON.stringify({
          entitlementId,
          title,
          description,
          ctaText,
          currency,
          priceCents: Math.round(Number(price) * 100),
          productIds: selected,
          status: "DRAFT",
        }),
      });
      sessionStorage.setItem(OFFER_NOTICE_KEY, "Offer saved.");
      router.push("/reseller/offers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create offer");
      setBusy(false);
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader title="New offer" subtitle="Set your resale price and offer details." />
        <ResellerGate>
          <ResellerNav />
          <form className="reseller-card reseller-form" onSubmit={(e) => void onSubmit(e)}>
            {error ? <p className="error">{error}</p> : null}
            <label>
              Offer name
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              Description
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label>
              Resale price
              <input
                type="number"
                min={current?.policy?.minPriceCents ? current.policy.minPriceCents / 100 : 1}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label>
              Currency
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
            </label>
            <label>
              Button text
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            </label>
            <button className="btn lime" type="submit" disabled={busy || !selected.length}>
              Save draft
            </button>
          </form>
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
