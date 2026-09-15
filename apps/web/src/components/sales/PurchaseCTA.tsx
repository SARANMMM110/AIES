"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { COMPLETE_SUITE_SLUG, formatMoney } from "@/lib/purchase";

type PurchaseType = "product" | "bundle";

type Props = {
  type: PurchaseType;
  slug: string;
  label: string;
  className?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  autoIntentParam?: string;
  priceCents?: number | null;
  currency?: string;
};

/**
 * Legacy single-item CTA — still supported; prefers unified /api/purchases
 * and redirects to the confirmation page.
 */
export function PurchaseCTA({
  type,
  slug,
  label,
  className = "sales-btn sales-btn-primary",
  secondaryHref,
  secondaryLabel,
  autoIntentParam = "intent",
  priceCents,
  currency = "USD",
}: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranAuto = useRef(false);

  async function runPurchase() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{
        paymentStatus: string;
        paymentNote?: string;
        redirectTo: string;
        alreadyHadAccess?: boolean;
      }>("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          items: [{ type, slug }],
        }),
      });
      setMessage(
        `${data.paymentNote ?? "Purchase completed."}${
          data.alreadyHadAccess ? " You already had access to this agency." : ""
        }`
      );
      router.push(data.redirectTo);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    if (loading) return;
    if (!user) {
      const returnTo = `${window.location.pathname}?${autoIntentParam}=${type === "bundle" ? "suite" : "product"}`;
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    void runPurchase();
  }

  useEffect(() => {
    if (loading || !user || ranAuto.current) return;
    const intent = searchParams.get(autoIntentParam);
    const match =
      (type === "product" && intent === "product") ||
      (type === "bundle" && (intent === "suite" || intent === "bundle"));
    if (!match) return;
    ranAuto.current = true;
    void runPurchase();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after auth return
  }, [loading, user, searchParams, type, autoIntentParam]);

  return (
    <div>
      <button type="button" className={className} onClick={onClick} disabled={busy || loading} style={{ width: "100%" }}>
        {busy ? "Processing…" : label}
      </button>
      {secondaryHref && secondaryLabel ? (
        <a className="btn white" href={secondaryHref} style={{ width: "100%", marginTop: 8, display: "inline-flex" }}>
          {secondaryLabel}
        </a>
      ) : null}
      <p className="sales-note">
        {formatMoney(priceCents, currency)}
        {type === "bundle" ? ` · ${COMPLETE_SUITE_SLUG}` : ""} · simulated purchase (gateway pending)
      </p>
      {message ? <p className="sales-toast" role="status">{message}</p> : null}
      {error ? (
        <p className="sales-toast error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
