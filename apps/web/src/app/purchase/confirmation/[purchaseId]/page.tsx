"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { apiFetch } from "@/lib/api";
import { formatMoney, purchaseTypeLabel } from "@/lib/purchase";
import "@/components/sales/purchase-flow.css";

type PurchaseDetail = {
  purchase: {
    id: string;
    code: string;
    status: string;
    purchaseType: string;
    totalAmount: number;
    subtotalAmount?: number;
    discountAmount?: number;
    currency: string;
    paymentStatus: string;
    paymentNote: string | null;
    paymentProvider?: string | null;
    providerPaymentId?: string | null;
    paidAt?: string | null;
    accessProvisionedAt?: string | null;
    createdAt: string;
    items: Array<{
      itemType: string;
      price: number;
      product: { id: string; name: string | null; slug: string | null } | null;
      bundle: { id: string; name: string | null; slug: string | null } | null;
    }>;
  };
  accessGranted: Array<{
    productId: string;
    name: string;
    slug: string;
    source: string;
  }>;
};

export default function PurchaseConfirmationPage() {
  return (
    <Suspense fallback={<div className="panel muted">Loading purchase…</div>}>
      <PurchaseConfirmationInner />
    </Suspense>
  );
}

function PurchaseConfirmationInner() {
  const params = useParams<{ purchaseId: string }>();
  const search = useSearchParams();
  const cancelled = search.get("cancelled") === "1";
  const [data, setData] = useState<PurchaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);

  async function load() {
    const detail = await apiFetch<PurchaseDetail>(`/api/purchases/${params.purchaseId}`);
    setData(detail);
    try {
      const status = await apiFetch<{
        accessReady: boolean;
        verifying: boolean;
        purchase: PurchaseDetail["purchase"];
      }>(`/api/payments/purchases/${params.purchaseId}/status`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              purchase: { ...prev.purchase, ...status.purchase },
            }
          : prev
      );
      setVerifying(status.verifying && !status.accessReady);
      return status;
    } catch {
      setVerifying(
        detail.purchase.paymentStatus === "REQUIRES_PAYMENT" ||
          detail.purchase.status === "PENDING"
      );
      return null;
    }
  }

  useEffect(() => {
    let cancelledLoop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const status = await load();
        if (cancelledLoop) return;
        if (status?.verifying && !status.accessReady) {
          timer = setTimeout(() => void tick(), 2500);
        }
      } catch (err) {
        if (!cancelledLoop) {
          setError(err instanceof Error ? err.message : "Failed to load purchase");
          setVerifying(false);
        }
      }
    }

    void tick();
    return () => {
      cancelledLoop = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.purchaseId]);

  const firstProduct = data?.accessGranted[0];
  const paid =
    data?.purchase.paymentStatus === "PAID" ||
    data?.purchase.paymentStatus === "SIMULATED" ||
    Boolean(data?.purchase.accessProvisionedAt);
  const accessReady = Boolean(data?.purchase.accessProvisionedAt) || (data?.accessGranted.length ?? 0) > 0;
  const failed =
    cancelled ||
    data?.purchase.paymentStatus === "FAILED" ||
    data?.purchase.paymentStatus === "CANCELLED";

  return (
    <Protected>
      <AppShell>
        <div className="purchase-confirm">
          {error ? <p className="error">{error}</p> : null}
          {!data && !error ? <div className="panel muted">Loading purchase…</div> : null}
          {data ? (
            <>
              <div className="purchase-confirm-hero panel">
                <p className="eyebrow">
                  {failed
                    ? "Payment not completed"
                    : verifying
                      ? "Verifying payment…"
                      : paid && accessReady
                        ? "Purchase successful"
                        : paid
                          ? "Payment received"
                          : "Payment processing"}
                </p>
                <h1>
                  {failed
                    ? "Payment was not completed"
                    : verifying
                      ? "Verifying your payment"
                      : accessReady
                        ? "You're ready to work"
                        : "Payment received. Your access is being prepared."}
                </h1>
                <p>
                  {data.purchase.code} · {purchaseTypeLabel(data.purchase.purchaseType)} ·{" "}
                  {formatMoney(data.purchase.totalAmount, data.purchase.currency)}
                </p>
                <p className="muted">
                  Payment: {data.purchase.paymentStatus}
                  {data.purchase.paymentProvider ? ` · ${data.purchase.paymentProvider}` : ""}
                  {data.purchase.providerPaymentId
                    ? ` · ref ${data.purchase.providerPaymentId.slice(0, 18)}…`
                    : ""}
                </p>
                {data.purchase.paymentNote ? <p className="muted">{data.purchase.paymentNote}</p> : null}
              </div>

              <div className="dash-split">
                <section className="panel">
                  <h2>Order</h2>
                  <ul className="purchase-review-list">
                    {data.purchase.items.map((item) => (
                      <li key={item.product?.id ?? item.bundle?.id ?? item.itemType}>
                        <div>
                          <strong>{item.product?.name ?? item.bundle?.name ?? item.itemType}</strong>
                          <span>{item.itemType}</span>
                        </div>
                        <em>{formatMoney(item.price, data.purchase.currency)}</em>
                      </li>
                    ))}
                  </ul>
                  <div className="purchase-totals" style={{ marginTop: 12 }}>
                    <div>
                      Subtotal:{" "}
                      {formatMoney(
                        data.purchase.subtotalAmount ?? data.purchase.totalAmount,
                        data.purchase.currency
                      )}
                    </div>
                    <div>
                      Discount:{" "}
                      {formatMoney(data.purchase.discountAmount ?? 0, data.purchase.currency)}
                    </div>
                    <div>
                      <strong>
                        Total: {formatMoney(data.purchase.totalAmount, data.purchase.currency)}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <h2>Access status</h2>
                  {!accessReady ? (
                    <p className="muted">
                      {verifying
                        ? "Waiting for payment verification. This page updates automatically."
                        : paid
                          ? "Payment received. Your access is being prepared."
                          : "Access will appear after payment is verified."}
                    </p>
                  ) : (
                    <ul className="purchase-access-list">
                      {data.accessGranted.map((p) => (
                        <li key={p.productId}>
                          <span>✓ {p.name}</span>
                          <Link href={`/products/${p.slug}`}>Open</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="purchase-confirm-actions">
                {firstProduct && accessReady ? (
                  <Link className="btn" href={`/products/${firstProduct.slug}`}>
                    Open workspace →
                  </Link>
                ) : null}
                <Link className="btn ghost" href="/account/purchases">
                  Purchase history
                </Link>
                <Link className="btn ghost" href="/sales">
                  Back to catalog
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </AppShell>
    </Protected>
  );
}
