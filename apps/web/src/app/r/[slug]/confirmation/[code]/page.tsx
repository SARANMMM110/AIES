"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import "../../../../reseller/reseller.css";

type Status = {
  code: string;
  status: string;
  offerTitle: string;
  amountCents: number;
  currency: string;
  accessReady: boolean;
  productSlug: string | null;
  verifying: boolean;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function ResellerConfirmationPage() {
  const params = useParams<{ slug: string; code: string }>();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let stop = false;
    async function poll() {
      try {
        const next = await apiFetch<Status>(`/api/reseller/checkout/${params.code}`);
        if (stop) return;
        setStatus(next);
        if (next.verifying) setTimeout(() => void poll(), 2500);
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Payment verification pending");
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [loading, user, params.code]);

  if (!loading && !user) {
    return (
      <div className="reseller-public">
        <div className="reseller-public-card">
          <h1>Please log in</h1>
          <Link href={`/login?next=${encodeURIComponent(`/r/${params.slug}/confirmation/${params.code}`)}`}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reseller-public">
      <div className="reseller-public-card">
        {error ? <p className="error">{error}</p> : null}
        {!status ? <p>Your payment is being verified.</p> : null}
        {status?.status === "PAID" ? (
          <>
            <p className="reseller-kicker">Purchase successful</p>
            <h1>{status.offerTitle}</h1>
            <p>Amount: {money(status.amountCents, status.currency)}</p>
            <p>Status: Paid</p>
            <p>Access: {status.accessReady ? "Active" : "Provisioning pending"}</p>
            {status.productSlug ? (
              <Link className="btn lime" href={`/products/${status.productSlug}`}>Open agency</Link>
            ) : (
              <Link className="btn lime" href="/dashboard">Open workspace</Link>
            )}
          </>
        ) : null}
        {status?.status === "PENDING" ? (
          <>
            <h1>Payment processing</h1>
            <p>Your payment is being verified. Access is not granted until payment is confirmed.</p>
          </>
        ) : null}
        {status?.status === "FAILED" ? (
          <>
            <h1>Payment failed</h1>
            <p>No access was granted.</p>
            <Link className="btn lime" href={`/r/${params.slug}/checkout`}>Try again</Link>
          </>
        ) : null}
        {status?.status === "CANCELLED" ? (
          <>
            <h1>Payment cancelled</h1>
            <Link className="btn lime" href={`/r/${params.slug}/checkout`}>Try again</Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
