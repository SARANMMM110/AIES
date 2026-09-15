"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductSummary } from "@aes/shared";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ProductCard, StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface DashboardSummary {
  products: Array<
    ProductSummary & {
      accessLabel?: string;
      accessSource?: string;
    }
  >;
  recentlyUsed: ProductSummary[];
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    client: { id: string; name: string };
    product: { id: string; name: string; slug: string; icon: string | null } | null;
  }>;
  recentActivity: Array<{
    id: string;
    workflowKey: string;
    status: string;
    progressPercent: number;
    updatedAt: string;
    project: {
      id: string;
      name: string;
      product: { id: string; name: string; slug: string } | null;
    };
  }>;
  recentPurchases?: Array<{
    id: string;
    code: string;
    status: string;
    purchaseType: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
    items: Array<{ itemType: string; name: string; slug: string | null }>;
  }>;
  counts: { products: number; projects: number; activity: number; purchases?: number };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const summary = await apiFetch<DashboardSummary>("/api/dashboard/summary");
        setData(summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Protected>
      <AppShell>
        <section className="dash-hero">
          <div>
            <h1>Welcome{user ? `, ${user.firstName}` : ""}</h1>
            <p>
              Your workspace shows only agencies you purchased or were granted. Buy more from the
              sales catalog.
            </p>
          </div>
          <div className="dash-hero-actions">
            <Link className="btn lime" href="/products">
              My products
            </Link>
            <Link className="btn ghost" href="/contact">
              Buy agencies
            </Link>
            <Link className="btn ghost" href="/account">
              Account
            </Link>
          </div>
        </section>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <div className="panel muted">Loading dashboard…</div> : null}

        {data ? (
          <div className="stack-lg">
            <div className="stat-strip">
              <div className="stat-tile">
                <span>Products</span>
                <strong>{data.counts.products}</strong>
              </div>
              <div className="stat-tile">
                <span>Workflow activity</span>
                <strong>{data.counts.activity}</strong>
              </div>
              <div className="stat-tile">
                <span>Purchases</span>
                <strong>{data.counts.purchases ?? 0}</strong>
              </div>
            </div>

            <section>
              <div className="section-heading">
                <h2>Purchased agencies</h2>
                <Link href="/products">View all</Link>
              </div>
              {data.products.length === 0 ? (
                <div className="panel">
                  <EmptyState
                    title="No purchased agencies yet."
                    description="After you buy an agency or pack, it will appear here. Nothing else from the catalog is shown."
                  />
                  <div style={{ marginTop: "1rem" }}>
                    <Link className="btn lime" href="/contact">
                      Request agency access
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="product-grid">
                  {data.products.map((product) => (
                    <div key={product.id} className="stack" style={{ gap: "0.45rem" }}>
                      <ProductCard product={product} />
                      {product.accessLabel ? (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          {product.accessLabel}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Recent purchases</h2>
                <Link href="/account/purchases">History</Link>
              </div>
              {!data.recentPurchases?.length ? (
                <EmptyState
                  title="No purchases yet."
                  description="Completed purchases will show purchase ID, date, amount and status."
                />
              ) : (
                <ul className="simple-list">
                  {data.recentPurchases.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.code}</strong>
                        <span className="list-meta">
                          {new Date(p.createdAt).toLocaleDateString()} ·{" "}
                          {p.items.map((i) => i.name).join(", ")} ·{" "}
                          {(p.totalAmount / 100).toLocaleString(undefined, {
                            style: "currency",
                            currency: p.currency,
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                      <Link href={`/purchase/confirmation/${p.id}`}>
                        <StatusBadge status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dash-split">
              <div className="panel">
                <div className="section-heading">
                  <h2>Recently used</h2>
                </div>
                {data.recentlyUsed.length === 0 ? (
                  <EmptyState
                    title="No recently used products"
                    description="Open a product from My Products to see it here."
                  />
                ) : (
                  <ul className="simple-list">
                    {data.recentlyUsed.map((p) => (
                      <li key={p.id}>
                        <Link href={`/products/${p.slug}`}>{p.name}</Link>
                        <StatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Recent workflow activity</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <EmptyState
                  title="No workflow activity yet."
                  description="Progress from product workflows will appear here."
                />
              ) : (
                <ul className="simple-list">
                  {data.recentActivity.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.workflowKey}</strong>
                        <span className="list-meta">
                          {item.project.name}
                          {item.project.product ? ` · ${item.project.product.name}` : ""}
                          {` · ${item.progressPercent}%`}
                        </span>
                      </div>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </AppShell>
    </Protected>
  );
}
