import { COMPLETE_SUITE_SLUG } from "@/lib/sales/catalog";

export { COMPLETE_SUITE_SLUG };

const CART_KEY = "aes_purchase_cart";

export type PurchaseCart = {
  productSlugs: string[];
  /** When set, cart is a single bundle purchase (clears productSlugs). */
  bundleSlug: string | null;
  /** @deprecated use bundleSlug === COMPLETE_SUITE_SLUG */
  includeSuite?: boolean;
};

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "Pricing configured by admin";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function emptyCart(): PurchaseCart {
  return { productSlugs: [], bundleSlug: null };
}

export function readCart(): PurchaseCart {
  if (typeof window === "undefined") return emptyCart();
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw) as PurchaseCart & { includeSuite?: boolean };
    const bundleSlug =
      parsed.bundleSlug ??
      (parsed.includeSuite ? COMPLETE_SUITE_SLUG : null);
    return {
      productSlugs: Array.isArray(parsed.productSlugs) ? [...new Set(parsed.productSlugs)] : [],
      bundleSlug: bundleSlug || null,
      includeSuite: Boolean(bundleSlug === COMPLETE_SUITE_SLUG),
    };
  } catch {
    return emptyCart();
  }
}

export function writeCart(cart: PurchaseCart) {
  if (typeof window === "undefined") return;
  const bundleSlug = cart.bundleSlug || (cart.includeSuite ? COMPLETE_SUITE_SLUG : null);
  sessionStorage.setItem(
    CART_KEY,
    JSON.stringify({
      productSlugs: bundleSlug ? [] : [...new Set(cart.productSlugs)],
      bundleSlug,
      includeSuite: bundleSlug === COMPLETE_SUITE_SLUG,
    })
  );
  window.dispatchEvent(new Event("aes-cart-change"));
}

export function addProductToCart(slug: string) {
  const cart = readCart();
  if (!cart.productSlugs.includes(slug)) cart.productSlugs.push(slug);
  cart.bundleSlug = null;
  cart.includeSuite = false;
  writeCart(cart);
  return cart;
}

export function removeProductFromCart(slug: string) {
  const cart = readCart();
  cart.productSlugs = cart.productSlugs.filter((s) => s !== slug);
  writeCart(cart);
  return cart;
}

export function setSuiteInCart(on: boolean) {
  return setBundleInCart(on ? COMPLETE_SUITE_SLUG : null);
}

export function setBundleInCart(slug: string | null) {
  const cart = emptyCart();
  cart.bundleSlug = slug;
  cart.includeSuite = slug === COMPLETE_SUITE_SLUG;
  writeCart(cart);
  return cart;
}

export function clearCart() {
  writeCart(emptyCart());
}

export function cartToApiItems(
  cart: PurchaseCart
): Array<{ type: "product" | "bundle"; slug: string }> {
  if (cart.bundleSlug) {
    return [{ type: "bundle", slug: cart.bundleSlug }];
  }
  if (cart.includeSuite) {
    return [{ type: "bundle", slug: COMPLETE_SUITE_SLUG }];
  }
  return cart.productSlugs.map((slug) => ({ type: "product" as const, slug }));
}

export function purchaseTypeLabel(type: string): string {
  switch (type) {
    case "PRODUCT":
      return "Individual purchase";
    case "MULTI_PRODUCT":
      return "Multi-agency purchase";
    case "BUNDLE":
      return "Bundle purchase";
    default:
      return type;
  }
}
