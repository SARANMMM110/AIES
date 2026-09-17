"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch } from "@/lib/api";
import { formatMoney, purchaseItemsLabel, purchaseTypeLabel } from "@/lib/purchase";
import { useClientPagination } from "@/hooks/useClientPagination";

type PurchaseRow = {
  id: string;
  code: string;
  status: string;
  purchaseType: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  items: Array<{
    itemType: string;
    product: { name: string | null; slug: string | null } | null;
    bundle: { name: string | null; slug: string | null } | null;
  }>;
};

export default function AccountPurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pager = useClientPagination(purchases);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ purchases: PurchaseRow[] }>("/api/purchases/me");
        setPurchases(data.purchases);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchases");
      }
    })();
  }, []);

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Purchase history"
          subtitle="Completed purchases and the access they provisioned. Payment gateway pending."
          actions={
            <Link className="btn lime" href="/purchase">
              New purchase
            </Link>
          }
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="panel">
          {purchases.length === 0 ? (
            <p className="muted">No purchases yet. Browse the sales catalog to get started.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Purchase ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <code>{p.code}</code>
                      </td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                      <td>{purchaseTypeLabel(p.purchaseType)}</td>
                      <td>{purchaseItemsLabel(p.items, p.purchaseType)}</td>
                      <td>{formatMoney(p.totalAmount, p.currency)}</td>
                      <td>{p.status}</td>
                      <td>
                        {p.id.startsWith("access-") ? (
                          <span className="muted">Access grant</span>
                        ) : (
                          <Link href={`/account/purchases/${p.id}`}>Receipt</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={pager.page}
                totalPages={pager.totalPages}
                total={pager.total}
                pageSize={pager.pageSize}
                show={pager.showPagination}
                onPageChange={pager.setPage}
              />
            </>
          )}
        </div>
      </AppShell>
    </Protected>
  );
}
