"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { apiFetch } from "@/lib/api";
import { formatMoney, purchaseItemLabel, purchaseTypeLabel } from "@/lib/purchase";

type PurchaseDetail = {
  id: string;
  code: string;
  status: string;
  purchaseType: string;
  subtotalAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  paymentNote?: string | null;
  accessProvisionedAt?: string | null;
  createdAt: string;
  items: Array<{
    itemType: string;
    quantity: number;
    price: number;
    product: { name: string | null; slug: string | null } | null;
    bundle: { name: string | null; slug: string | null } | null;
  }>;
};

export default function PurchaseReceiptPage() {
  const params = useParams<{ id: string }>();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [access, setAccess] = useState<
    Array<{ name: string; slug: string; source: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{
          purchase: PurchaseDetail;
          accessGranted: Array<{ name: string; slug: string; source: string }>;
        }>(`/api/purchases/${params.id}`);
        setPurchase(data.purchase);
        setAccess(data.accessGranted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load receipt");
      }
    })();
  }, [params.id]);

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Purchase receipt"
          subtitle="Invoice-ready purchase record (tax/VAT not calculated in this phase)."
          actions={
            <Link className="btn ghost" href="/account/purchases">
              Back
            </Link>
          }
        />
        {error ? <p className="error">{error}</p> : null}
        {!purchase ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="panel" style={{ display: "grid", gap: 14, maxWidth: 720 }}>
            <div>
              <div className="muted">Purchase ID</div>
              <strong>
                <code>{purchase.code}</code>
              </strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div className="muted">Date</div>
                {new Date(purchase.createdAt).toLocaleString()}
              </div>
              <div>
                <div className="muted">Status</div>
                <StatusBadge status={purchase.status} />
              </div>
              <div>
                <div className="muted">Type</div>
                {purchaseTypeLabel(purchase.purchaseType)}
              </div>
              <div>
                <div className="muted">Payment</div>
                {purchase.paymentStatus}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Line</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{purchaseItemLabel(item)}</td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.price, purchase.currency)}</td>
                    <td>{formatMoney(item.price * item.quantity, purchase.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: "right" }}>
              <div>
                Subtotal:{" "}
                {formatMoney(purchase.subtotalAmount ?? purchase.totalAmount, purchase.currency)}
              </div>
              <div>
                Discount: {formatMoney(purchase.discountAmount ?? 0, purchase.currency)}
              </div>
              <strong>Total: {formatMoney(purchase.totalAmount, purchase.currency)}</strong>
            </div>

            {purchase.paymentNote ? <p className="muted">{purchase.paymentNote}</p> : null}

            <div>
              <h3 style={{ marginTop: 0 }}>Access granted</h3>
              <ul>
                {access.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/products/${a.slug}`}>{a.name}</Link>{" "}
                    <span className="muted">({a.source})</span>
                  </li>
                ))}
              </ul>
              {purchase.accessProvisionedAt ? (
                <p className="muted">
                  Provisioned {new Date(purchase.accessProvisionedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </AppShell>
    </Protected>
  );
}
