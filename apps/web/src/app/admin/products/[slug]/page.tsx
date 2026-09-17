"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { Protected } from "@/components/Protected";
import { ToolLoadingPulse } from "@/components/ToolLoadingPulse";
import { apiFetch } from "@/lib/api";

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
};

export default function AdminProductViewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ product: ProductDetail }>(
          `/api/products/${encodeURIComponent(slug)}`
        );
        if (!cancelled) setProduct(data.product);
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setError(err instanceof Error ? err.message : "Failed to load product");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <Protected adminOnly>
        <AdminShell>
          <ToolLoadingPulse label="Loading product" fullPage={false} />
        </AdminShell>
      </Protected>
    );
  }

  if (error || !product) {
    return (
      <Protected adminOnly>
        <AdminShell>
          <EmptyState
            title="Product not found"
            description={error || "This agency could not be loaded."}
            action={
              <Link className="btn lime" href="/admin/products">
                Back to products
              </Link>
            }
          />
        </AdminShell>
      </Protected>
    );
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <Link className="btn ghost btn-sm" href="/admin/products">
            Back to products
          </Link>
        </div>
        <div
          className="panel"
          style={{
            padding: 0,
            overflow: "hidden",
            minHeight: "70vh",
          }}
        >
          <iframe
            title={`${product.name} preview`}
            src={`/products/${product.slug}`}
            style={{
              display: "block",
              width: "100%",
              height: "min(82vh, 960px)",
              border: 0,
              background: "#fff",
            }}
          />
        </div>
      </AdminShell>
    </Protected>
  );
}
