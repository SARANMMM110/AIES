"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { CatalogAgency, CatalogBundle } from "@/lib/sales/catalog";
import { COMPLETE_SUITE_SLUG } from "@/lib/sales/catalog";
import { agencySalesImage } from "@/lib/sales/agency-images";
import {
  addProductToCart,
  cartToApiItems,
  clearCart,
  formatMoney,
  readCart,
  removeProductFromCart,
  setBundleInCart,
  type PurchaseCart,
  writeCart,
} from "@/lib/purchase";
import { GuestCheckoutForm, type GuestAccountFields } from "./GuestCheckoutForm";
import type { PublicUser } from "@aes/shared";

type OwnedMap = Record<string, { source: string; bundleName?: string | null; bundleSlug?: string | null }>;

type Props = {
  agencies: CatalogAgency[];
  suite: CatalogBundle;
  bundles?: CatalogBundle[];
  focusSlug?: string;
  focusBundleSlug?: string;
  mode?: "full" | "compact" | "bundle";
  className?: string;
};

function ownedLabel(owned: OwnedMap[string] | undefined, ownsSuite: boolean): string {
  if (ownsSuite) return "Included in Complete Suite";
  if (owned?.bundleName) return `Included in: ${owned.bundleName}`;
  if (owned?.bundleSlug === COMPLETE_SUITE_SLUG) return "Included in Complete Suite";
  return "Owned";
}

export function PurchaseSelector({
  agencies,
  suite,
  bundles = [],
  focusSlug,
  focusBundleSlug,
  mode = "full",
  className,
}: Props) {
  const { user, loading: authLoading, applySession } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<PurchaseCart>({ productSlugs: [], bundleSlug: null });
  const [owned, setOwned] = useState<OwnedMap>({});
  const [ownedBundles, setOwnedBundles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** When set, show guest account form before completing this cart */
  const [pendingCart, setPendingCart] = useState<PurchaseCart | null>(null);

  const ownsSuite = Boolean(ownedBundles[COMPLETE_SUITE_SLUG] || ownedBundles[suite.slug]);
  const publishedBundles = useMemo(() => {
    const list = bundles.length ? bundles : [suite];
    return list.filter((b) => b.slug);
  }, [bundles, suite]);

  const syncCart = useCallback(() => setCart(readCart()), []);

  useEffect(() => {
    syncCart();
    const onChange = () => syncCart();
    window.addEventListener("aes-cart-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("aes-cart-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [syncCart]);

  useEffect(() => {
    if (authLoading || !user) {
      setOwned({});
      setOwnedBundles({});
      return;
    }
    void (async () => {
      try {
        const data = await apiFetch<{
          productAccess: Array<{
            product: { slug: string };
            source: string;
            bundle?: { slug: string; name: string } | null;
          }>;
          bundleAccess: Array<{ bundle: { slug: string; name: string } }>;
        }>("/api/access/me");
        const map: OwnedMap = {};
        for (const row of data.productAccess) {
          map[row.product.slug] = {
            source: row.source,
            bundleSlug: row.bundle?.slug ?? null,
            bundleName: row.bundle?.name ?? null,
          };
        }
        setOwned(map);
        const bmap: Record<string, string> = {};
        for (const row of data.bundleAccess) {
          bmap[row.bundle.slug] = row.bundle.name;
        }
        setOwnedBundles(bmap);
      } catch {
        /* ignore */
      }
    })();
  }, [user, authLoading]);

  const selectedAgencies = useMemo(
    () => agencies.filter((a) => cart.productSlugs.includes(a.slug)),
    [agencies, cart.productSlugs]
  );

  const activeBundle = cart.bundleSlug
    ? publishedBundles.find((b) => b.slug === cart.bundleSlug) ??
      (cart.bundleSlug === suite.slug ? suite : null)
    : null;

  const individualTotal = selectedAgencies.reduce((sum, a) => sum + (a.priceCents ?? 0), 0);
  const pricingConfigured =
    selectedAgencies.every((a) => a.priceCents != null) &&
    (activeBundle ? activeBundle.priceCents != null : true);

  function toggleAgency(slug: string) {
    if (owned[slug] || ownsSuite) return;
    const next = cart.productSlugs.includes(slug)
      ? removeProductFromCart(slug)
      : addProductToCart(slug);
    setCart(next);
  }

  function buyFocusedAgency() {
    if (!focusSlug) return;
    if (owned[focusSlug] || ownsSuite) {
      router.push(`/products/${focusSlug}`);
      return;
    }
    const next = addProductToCart(focusSlug);
    setCart(next);
    void completePurchase(next);
  }

  function addAnother() {
    if (focusSlug && !owned[focusSlug] && !ownsSuite) {
      setCart(addProductToCart(focusSlug));
    }
    router.push("/purchase");
  }

  async function completePurchase(override?: PurchaseCart, account?: GuestAccountFields) {
    const active = override ?? cart;
    const items = cartToApiItems(active);
    if (!items.length) {
      setError("Select at least one agency or a bundle.");
      return;
    }
    if (!user && !account) {
      setPendingCart(active);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{
        mode?: "completed" | "checkout";
        redirectTo: string;
        checkoutUrl?: string | null;
        paymentNote?: string;
        paymentStatus?: string;
        purchase?: { id: string };
        tokens?: { accessToken: string };
        user?: PublicUser;
        accountCreated?: boolean;
      }>("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          items,
          ...(account ? { account } : {}),
        }),
      });
      if (data.tokens?.accessToken && data.user) {
        applySession(data.tokens.accessToken, data.user);
      }
      clearCart();
      setCart(readCart());
      setPendingCart(null);
      if (data.checkoutUrl) {
        setMessage("Redirecting to secure payment…");
        window.location.href = data.checkoutUrl;
        return;
      }
      setMessage(data.paymentNote ?? "Purchase completed.");
      const confirmId = data.purchase?.id;
      router.push(
        confirmId
          ? `/purchase/confirmation/${confirmId}`
          : data.redirectTo || "/products"
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  function chooseBundle(slug: string) {
    if (ownedBundles[slug]) {
      router.push("/products");
      return;
    }
    const next = setBundleInCart(slug);
    setCart(next);
    void completePurchase(next);
  }

  function chooseSuite() {
    chooseBundle(suite.slug || COMPLETE_SUITE_SLUG);
  }

  function renderGuestCheckout(forCart: PurchaseCart) {
    return (
      <GuestCheckoutForm
        busy={busy}
        error={error}
        onSubmit={(account) => completePurchase(forCart, account)}
      />
    );
  }

  const focusBundle =
    focusBundleSlug
      ? publishedBundles.find((b) => b.slug === focusBundleSlug) ??
        (focusBundleSlug === suite.slug ? suite : null)
      : null;

  if ((mode === "compact" || mode === "bundle") && focusBundle) {
    const ownsThis = Boolean(ownedBundles[focusBundle.slug]);
    const productSlugs = focusBundle.productSlugs ?? focusBundle.products?.map((p) => p.slug) ?? [];
    const alreadyOwned = productSlugs.filter((s) => owned[s] || ownsSuite);
    const newFromBundle = productSlugs.filter((s) => !owned[s] && !ownsSuite);

    return (
      <div className={className}>
        {ownsThis ? (
          <div className="purchase-owned-stack">
            <span className="purchase-badge owned">OWNED</span>
            <Link className="btn lime" href="/products" style={{ width: "100%" }}>
              Open Included Products →
            </Link>
          </div>
        ) : pendingCart ? (
          renderGuestCheckout(pendingCart)
        ) : (
          <>
            {alreadyOwned.length || newFromBundle.length ? (
              <div className="purchase-owned-stack" style={{ marginBottom: 12 }}>
                {alreadyOwned.length ? (
                  <p className="sales-note" style={{ margin: 0 }}>
                    <strong>Already owned:</strong>{" "}
                    {alreadyOwned
                      .map((s) => agencies.find((a) => a.slug === s)?.name ?? s)
                      .join(", ")}
                  </p>
                ) : null}
                {newFromBundle.length ? (
                  <p className="sales-note" style={{ margin: "6px 0 0" }}>
                    <strong>New from this bundle:</strong>{" "}
                    {newFromBundle
                      .map((s) => agencies.find((a) => a.slug === s)?.name ?? s)
                      .join(", ")}
                  </p>
                ) : (
                  <p className="sales-note">You already own every agency in this pack.</p>
                )}
              </div>
            ) : null}
            <button
              type="button"
              className="btn lime"
              style={{ width: "100%" }}
              onClick={() => chooseBundle(focusBundle.slug)}
              disabled={busy || authLoading || newFromBundle.length === 0}
            >
              {busy ? "Processing…" : `Buy ${focusBundle.name} →`}
            </button>
            <p className="sales-note">
              {formatMoney(focusBundle.priceCents, focusBundle.currency)}
              {focusBundle.savingsCents
                ? ` · save ${formatMoney(focusBundle.savingsCents, focusBundle.currency)}`
                : ""}
              {" · "}
              account created at purchase
            </p>
          </>
        )}
        {!pendingCart && error ? (
          <p className="sales-toast error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="sales-toast" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  if (mode === "compact" && focusSlug) {
    const agency = agencies.find((a) => a.slug === focusSlug);
    const isOwned = Boolean(owned[focusSlug] || ownsSuite);
    return (
      <div className={className}>
        {isOwned ? (
          <div className="purchase-owned-stack">
            <span className="purchase-badge owned">{ownedLabel(owned[focusSlug], ownsSuite)}</span>
            <Link className="btn lime" href={`/products/${focusSlug}`} style={{ width: "100%" }}>
              Open Workspace →
            </Link>
            <Link className="btn white" href="/sales" style={{ width: "100%", marginTop: 8 }}>
              Browse other agencies
            </Link>
          </div>
        ) : pendingCart ? (
          renderGuestCheckout(pendingCart)
        ) : (
          <>
            <button
              type="button"
              className="btn lime"
              style={{ width: "100%" }}
              onClick={buyFocusedAgency}
              disabled={busy || authLoading}
            >
              Buy This Agency →
            </button>
            <button
              type="button"
              className="btn white"
              style={{ width: "100%", marginTop: 8 }}
              onClick={addAnother}
            >
              Add Another Agency
            </button>
            {agency ? (
              <p className="sales-note">
                {formatMoney(agency.priceCents, agency.currency)}
                {agency.priceCents == null ? "" : " · account created at purchase"}
              </p>
            ) : null}
          </>
        )}
        {!pendingCart && error ? (
          <p className="sales-toast error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="sales-toast" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`purchase-selector ${className ?? ""}`}>
      <div className="purchase-selector-head">
        <div>
          <div className="tag">Purchase Selector</div>
          <h2>Build Your Agency Suite</h2>
          <p>
            Select one or more agencies, or choose a published bundle. Access is provisioned
            immediately — payment gateway comes later.
          </p>
        </div>
        <div className="purchase-selector-summary">
          <div>
            <span>Selected</span>
            <strong>
              {activeBundle ? activeBundle.agencyCount : selectedAgencies.length}
            </strong>
          </div>
          <div>
            <span>Total</span>
            <strong>
              {activeBundle
                ? formatMoney(activeBundle.priceCents, activeBundle.currency)
                : selectedAgencies.length
                  ? formatMoney(
                      pricingConfigured ? individualTotal : null,
                      selectedAgencies[0]?.currency ?? "USD"
                    )
                  : formatMoney(null)}
            </strong>
          </div>
        </div>
      </div>

      <div className="purchase-agency-grid">
        {agencies.map((agency) => {
          const isOwned = Boolean(owned[agency.slug] || ownsSuite);
          const selected = cart.productSlugs.includes(agency.slug) && !cart.bundleSlug;
          return (
            <button
              key={agency.slug}
              type="button"
              className={`purchase-agency-card${selected ? " selected" : ""}${isOwned ? " owned" : ""}`}
              onClick={() =>
                isOwned ? router.push(`/products/${agency.slug}`) : toggleAgency(agency.slug)
              }
              disabled={Boolean(cart.bundleSlug) && !isOwned}
            >
              <div className="purchase-agency-top">
                {(() => {
                  const image = agencySalesImage(agency.slug);
                  return image ? (
                    <span className="purchase-agency-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="" width={80} height={80} />
                    </span>
                  ) : (
                    <span className="purchase-agency-icon" style={{ background: agency.accent }}>
                      {agency.icon ?? agency.name.charAt(0)}
                    </span>
                  );
                })()}
                {isOwned ? (
                  <span className="purchase-badge owned">
                    {ownsSuite ? "In Suite" : owned[agency.slug]?.bundleName ? "In Pack" : "Owned"}
                  </span>
                ) : selected ? (
                  <span className="purchase-badge selected">Selected</span>
                ) : (
                  <span className="purchase-badge">Add</span>
                )}
              </div>
              <strong>{agency.name}</strong>
              <small>
                {agency.serviceCount} services · {agency.workflowCount} workflows
              </small>
              {isOwned ? (
                <em>{ownedLabel(owned[agency.slug], ownsSuite)}</em>
              ) : (
                <em>{formatMoney(agency.priceCents, agency.currency)}</em>
              )}
            </button>
          );
        })}
      </div>

      {publishedBundles.length ? (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <div className="tag">Bundles</div>
          {publishedBundles.map((bundle) => {
            const ownsThis = Boolean(ownedBundles[bundle.slug]);
            return (
              <div key={bundle.slug} className="purchase-suite-card">
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {bundle.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bundle.thumbnailUrl}
                      alt=""
                      width={72}
                      height={48}
                      style={{
                        width: 72,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  <div>
                    <h3>{bundle.name}</h3>
                    <p>
                      {bundle.agencyCount} agencies · {bundle.serviceCount} services ·{" "}
                      {bundle.workflowCount} workflows
                    </p>
                    <em>{formatMoney(bundle.priceCents, bundle.currency)}</em>
                    {bundle.savingsCents ? (
                      <p className="sales-note" style={{ margin: "4px 0 0" }}>
                        Save {formatMoney(bundle.savingsCents, bundle.currency)} vs individual
                      </p>
                    ) : null}
                  </div>
                </div>
                {ownsThis ? (
                  <Link className="btn lime" href="/products">
                    Open Included Products
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="btn lime"
                    onClick={() => chooseBundle(bundle.slug)}
                    disabled={busy}
                  >
                    {busy && cart.bundleSlug === bundle.slug ? "Processing…" : "Buy Bundle"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="purchase-suite-card">
          <div>
            <h3>{suite.name}</h3>
            <p>
              All 10 agencies · {suite.serviceCount} services · {suite.workflowCount} workflows
            </p>
            <em>{formatMoney(suite.priceCents, suite.currency)}</em>
          </div>
          {ownsSuite ? (
            <Link className="btn lime" href="/products">
              Open My Products
            </Link>
          ) : (
            <button type="button" className="btn lime" onClick={chooseSuite} disabled={busy}>
              {busy && cart.bundleSlug === suite.slug ? "Processing…" : "Buy Complete Suite"}
            </button>
          )}
        </div>
      )}

      <div className="purchase-selector-actions">
        <button
          type="button"
          className="btn white"
          onClick={() => {
            writeCart({ productSlugs: [], bundleSlug: null });
            setCart(readCart());
            setPendingCart(null);
          }}
        >
          Clear selection
        </button>
        <button
          type="button"
          className="btn lime"
          disabled={busy || (!cart.bundleSlug && selectedAgencies.length === 0)}
          onClick={() => void completePurchase()}
        >
          {user ? "Proceed to payment →" : "Proceed to payment & create account →"}
        </button>
      </div>

      {pendingCart ? renderGuestCheckout(pendingCart) : null}

      {!pendingCart && error ? (
        <p className="sales-toast error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
