"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard, type LibraryProduct } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { apiFetch } from "@/lib/api";

export default function MyProductsPage() {
  const [products, setProducts] = useState<LibraryProduct[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{
          products: LibraryProduct[];
          ownedCount: number;
          totalCount: number;
        }>("/api/products/library");
        setProducts(data.products);
        setOwnedCount(data.ownedCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const owned = products.filter((p) => p.owned);
  const locked = products.filter((p) => p.locked);

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Products"
          subtitle={`${ownedCount} unlocked · ${products.length} agencies in the studio. Locked agencies can be previewed; purchase or admin unlock grants full access.`}
          actions={
            <Link className="btn lime" href="/contact">
              Buy agencies
            </Link>
          }
        />
        {error ? <p className="error">{error}</p> : null}
        {loading ? <div className="panel muted">Loading products…</div> : null}

        {!loading && products.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="No agencies in the catalog."
              description="Published agencies will appear here."
            />
          </div>
        ) : null}

        {owned.length > 0 ? (
          <section style={{ marginBottom: "1.75rem" }}>
            <div className="section-heading">
              <h2>Your agencies</h2>
            </div>
            <div className="product-grid">
              {owned.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : !loading ? (
          <div className="panel" style={{ marginBottom: "1.75rem" }}>
            <EmptyState
              title="No unlocked agencies yet."
              description="Preview any locked agency below. After purchase or admin access, your agencies appear here."
              action={
                <Link className="btn lime" href="/contact">
                  Request access
                </Link>
              }
            />
          </div>
        ) : null}

        {locked.length > 0 ? (
          <section>
            <div className="section-heading">
              <h2>Locked agencies</h2>
              <span className="muted">Preview available · purchase to unlock</span>
            </div>
            <div className="product-grid">
              {locked.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ) : null}
      </AppShell>
    </Protected>
  );
}
