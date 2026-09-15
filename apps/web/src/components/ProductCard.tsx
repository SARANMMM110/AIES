"use client";

import Link from "next/link";
import type { ProductSummary } from "@aes/shared";
import { formatMoney } from "@/lib/purchase";

export function StatusBadge({ status }: { status: string }) {
  const value = status.toUpperCase();
  const tone =
    value === "PUBLISHED" ||
    value === "ACTIVE" ||
    value === "COMPLETED" ||
    value === "OWNED" ||
    value === "PAID" ||
    value === "SUCCESS"
      ? "success status"
      : value === "DRAFT" || value === "IN_PROGRESS" || value === "LOCKED" || value === "PENDING"
        ? value === "PENDING"
          ? "pending status"
          : "draft status"
        : value === "FAILED" || value === "REVOKED" || value === "CANCELLED" || value === "REFUNDED"
          ? "danger status"
          : "muted status";
  return <span className={`badge ${tone}`}>{status}</span>;
}

export type LibraryProduct = ProductSummary & {
  owned?: boolean;
  locked?: boolean;
  accessLabel?: string;
};

export function ProductCard({
  product,
  href,
}: {
  product: LibraryProduct;
  href?: string;
}) {
  const locked = Boolean(product.locked ?? product.owned === false);
  const owned = product.owned === true || (!locked && product.owned !== false);
  const target = href ?? `/products/${product.slug}`;
  const blurb =
    product.shortDescription || product.tagline || product.description || "No description yet.";

  return (
    <article className={`product-card${locked ? " product-card-locked" : ""}`}>
      <div className="product-card-top">
        <div className="product-icon" aria-hidden>
          {(product.icon || product.name.slice(0, 2)).toUpperCase()}
        </div>
        <StatusBadge status={locked ? "LOCKED" : "OWNED"} />
      </div>
      <h3>{product.name}</h3>
      <p>{blurb}</p>
      <div className="product-card-meta">
        <span>{product.workflowCount ?? 0} workflows</span>
        <span>{product.resourceCount ?? 0} resources</span>
        <span>{formatMoney(product.priceCents, product.currency)}</span>
      </div>
      {product.accessLabel ? (
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
          {product.accessLabel}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {owned && !locked ? (
          <Link className="btn lime" href={target}>
            Open workspace
          </Link>
        ) : (
          <>
            <Link className="btn" href={target}>
              Preview agency
            </Link>
            <Link className="btn lime" href={`/contact?focus=${encodeURIComponent(product.slug)}`}>
              Purchase
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
