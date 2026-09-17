"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { formatMoney } from "@/lib/purchase";
import { flashToast } from "@/components/Toast";
import { apiFetch, ApiClientError } from "@/lib/api";
import { ADMIN_CACHE_KEYS, clearAdminCache } from "@/lib/admin-list-cache";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  icon: string | null;
};

type BundleDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  status: string;
  priceCents: number | null;
  currency: string;
  icon: string | null;
  thumbnailUrl: string | null;
  displayOrder: number;
  items: Array<{ productId: string; product: ProductOption }>;
  individualValueCents?: number;
  savingsCents?: number;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function BundleEditorPage({ mode }: { mode: "new" | "edit" }) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const bundleId = mode === "edit" ? params.id : undefined;

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [icon, setIcon] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState(10);
  const [status, setStatus] = useState("DRAFT");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");

  const loadProducts = useCallback(async () => {
    const data = await apiFetch<{ products: ProductOption[] }>("/api/products");
    setProducts(data.products);
  }, []);

  const applyBundle = useCallback((bundle: BundleDetail) => {
    setName(bundle.name);
    setSlug(bundle.slug);
    setSlugTouched(true);
    setShortDescription(bundle.shortDescription ?? "");
    setDescription(bundle.description ?? "");
    setPriceDollars(
      bundle.priceCents == null ? "" : (bundle.priceCents / 100).toFixed(bundle.priceCents % 100 ? 2 : 0)
    );
    setCurrency(bundle.currency || "USD");
    setIcon(bundle.icon ?? "");
    setThumbnailUrl(bundle.thumbnailUrl ?? "");
    setDisplayOrder(bundle.displayOrder ?? 0);
    setStatus(bundle.status);
    setSelectedIds(bundle.items.map((i) => i.productId));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadProducts();
        if (mode === "edit" && bundleId) {
          const data = await apiFetch<{ bundle: BundleDetail }>(`/api/bundles/${bundleId}`);
          applyBundle(data.bundle);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load editor");
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, bundleId, loadProducts, applyBundle]);

  const selectedProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as ProductOption[];
  }, [products, selectedIds]);

  const individualValue = selectedProducts.reduce((sum, p) => sum + (p.priceCents ?? 0), 0);
  const priceCents =
    priceDollars.trim() === "" ? null : Math.round(Number(priceDollars) * 100);
  const savings =
    priceCents != null && individualValue > priceCents ? individualValue - priceCents : 0;

  function toggleProduct(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function moveSelected(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function save(publishAfter = false) {
    setBusy(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Bundle name is required");
      if (!selectedIds.length && (publishAfter || status === "ACTIVE")) {
        throw new Error("Published bundles need at least one product");
      }
      if ((publishAfter || status === "ACTIVE") && (priceCents == null || Number.isNaN(priceCents))) {
        throw new Error("Published bundles need a valid price");
      }

      const payload = {
        name: name.trim(),
        slug: (slugTouched ? slug : slugify(name)).trim() || slugify(name),
        shortDescription: shortDescription.trim() || null,
        description: description.trim() || null,
        priceCents: priceCents != null && !Number.isNaN(priceCents) ? priceCents : null,
        currency,
        icon: icon.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        displayOrder,
        status: publishAfter ? "ACTIVE" : status,
        productIds: selectedIds,
      };

      let saved: BundleDetail;
      if (mode === "new") {
        const data = await apiFetch<{ bundle: BundleDetail }>("/api/bundles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        saved = data.bundle;
      } else {
        const data = await apiFetch<{ bundle: BundleDetail }>(`/api/bundles/${bundleId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        saved = data.bundle;
      }

      if (publishAfter && saved.status !== "ACTIVE") {
        const pub = await apiFetch<{ bundle: BundleDetail }>(`/api/bundles/${saved.id}/publish`, {
          method: "POST",
        });
        saved = pub.bundle;
      }

      flashToast(
        publishAfter || saved.status === "ACTIVE"
          ? mode === "new"
            ? "Bundle created and published."
            : "Bundle saved and published."
          : mode === "new"
            ? "Bundle created."
            : "Bundle saved.",
        "success"
      );
      clearAdminCache(ADMIN_CACHE_KEYS.bundles);
      router.push(`/admin/bundles/${saved.id}`);
      if (mode === "edit") applyBundle(saved);
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error ? err.message : "Save failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Protected adminOnly>
        <AdminShell>
          <p className="muted">Loading bundle editor…</p>
        </AdminShell>
      </Protected>
    );
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title={mode === "new" ? "Create bundle" : "Edit bundle"}
          subtitle="Select any combination of the 10 agencies. Pricing is stored in the database."
          actions={
            <>
              <Link className="btn ghost" href="/admin/bundles">
                Back
              </Link>
              {slug ? (
                <Link className="btn ghost" href={`/sales/bundles/${slug}`} target="_blank">
                  Open sales page
                </Link>
              ) : null}
            </>
          }
        />
        {error ? <p className="error">{error}</p> : null}

        <div className="dash-split" style={{ alignItems: "start" }}>
          <div className="panel" style={{ display: "grid", gap: 12 }}>
            <label>
              Bundle name
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label>
              Slug
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label>
              Short description
              <input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                maxLength={500}
              />
            </label>
            <label>
              Description
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="bundle-price-row">
              <label>
                Price ({currency || "USD"})
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceDollars}
                  onChange={(e) => setPriceDollars(e.target.value)}
                  placeholder="799"
                />
              </label>
              <label>
                Currency
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                >
                  {Array.from(
                    new Set([currency || "USD", "USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD"])
                  ).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Icon
                <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📦" />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
                />
              </label>
            </div>
            <label>
              Thumbnail URL
              <input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>
            {thumbnailUrl.trim() ? (
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--border, #d5ddd8)",
                  background: "var(--panel-soft, #eef2ef)",
                  aspectRatio: "16 / 9",
                  maxWidth: 360,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl.trim()}
                  alt="Bundle thumbnail preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                  }}
                />
              </div>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Shown on the sales catalog and bundle sales page.
              </p>
            )}
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Published (Active)</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn lime" disabled={busy} onClick={() => void save(false)}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn white"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Save & publish
              </button>
            </div>
          </div>

          <div className="panel" style={{ display: "grid", gap: 14 }}>
            <div>
              <strong>Select products</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                At least one agency required to publish. Duplicates are blocked.
              </p>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {products.map((p) => {
                const checked = selectedIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "8px 10px",
                      border: "1px solid var(--border, #ddd)",
                      borderRadius: 8,
                      background: checked ? "color-mix(in srgb, #caff45 18%, transparent)" : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span style={{ flex: 1 }}>
                      <strong>{p.name}</strong>
                      <div className="list-meta">
                        {p.slug} · {formatMoney(p.priceCents, p.currency)}
                      </div>
                    </span>
                  </label>
                );
              })}
            </div>

            <div>
              <strong>Selected ({selectedProducts.length})</strong>
              {selectedProducts.length === 0 ? (
                <p className="muted">No products selected yet.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
                  {selectedProducts.map((p, index) => (
                    <li
                      key={p.id}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 8px",
                        border: "1px solid var(--border, #ddd)",
                        borderRadius: 8,
                      }}
                    >
                      <span>
                        {index + 1}. {p.name}
                      </span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="btn ghost" onClick={() => moveSelected(p.id, -1)}>
                          ↑
                        </button>
                        <button type="button" className="btn ghost" onClick={() => moveSelected(p.id, 1)}>
                          ↓
                        </button>
                        <button type="button" className="btn ghost" onClick={() => toggleProduct(p.id)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel" style={{ margin: 0, background: "transparent" }}>
              <div className="list-meta">Individual value: {formatMoney(individualValue, currency)}</div>
              <div className="list-meta">Bundle price: {formatMoney(priceCents, currency)}</div>
              <div className="list-meta">Savings: {formatMoney(savings || null, currency)}</div>
            </div>
          </div>
        </div>
      </AdminShell>
    </Protected>
  );
}
