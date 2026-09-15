import {
  prisma,
  type Purchase,
  type PurchaseItem,
  type PurchaseType,
  type Prisma,
} from "@aes/database";
import { AppError } from "../../utils/errors";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { COMPLETE_SUITE_SLUG } from "../catalog/catalog.routes";
import { grantBundleAccess, grantDirectProductAccess } from "../access/grant-access";
import { writeAuditLog } from "../audit/audit";

export type PurchaseRequestItem =
  | { type: "product"; slug: string }
  | { type: "bundle"; slug: string };

export type ResolvedLine =
  | {
      itemType: "PRODUCT";
      productId: string;
      slug: string;
      name: string;
      price: number;
      currency: string;
      alreadyOwned: boolean;
    }
  | {
      itemType: "BUNDLE";
      bundleId: string;
      slug: string;
      name: string;
      price: number;
      currency: string;
      productSlugs: string[];
      alreadyOwned: boolean;
    };

function makePurchaseCode(): string {
  return `PUR-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export async function userOwnsProduct(userId: string, productId: string): Promise<boolean> {
  const row = await prisma.productAccess.findFirst({
    where: {
      userId,
      productId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
  });
  return Boolean(row);
}

export async function userOwnsBundle(userId: string, bundleId: string): Promise<boolean> {
  const row = await prisma.bundleAccess.findFirst({
    where: {
      userId,
      bundleId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
  });
  return Boolean(row);
}

export async function resolvePurchaseItems(
  userId: string,
  items: PurchaseRequestItem[]
): Promise<{ lines: ResolvedLine[]; purchaseType: PurchaseType; currency: string; totalAmount: number }> {
  if (!items.length) {
    throw new AppError(400, "At least one purchase item is required", "EMPTY_CART");
  }

  const seen = new Set<string>();
  const lines: ResolvedLine[] = [];

  for (const raw of items) {
    const key = `${raw.type}:${raw.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (raw.type === "product") {
      if (!(APPROVED_PRODUCT_SLUGS as readonly string[]).includes(raw.slug)) {
        throw new AppError(400, `Invalid agency product: ${raw.slug}`, "INVALID_PRODUCT");
      }
      const product = await prisma.product.findUnique({ where: { slug: raw.slug } });
      if (!product) throw new AppError(404, "Product not found", "NOT_FOUND");
      if (product.status !== "PUBLISHED") {
        throw new AppError(400, `${product.name} is not available for purchase`, "PRODUCT_UNAVAILABLE");
      }
      lines.push({
        itemType: "PRODUCT",
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.priceCents ?? 0,
        currency: product.currency,
        alreadyOwned: await userOwnsProduct(userId, product.id),
      });
    } else {
      const slug = raw.slug === "complete-suite" ? COMPLETE_SUITE_SLUG : raw.slug;
      const bundle = await prisma.bundle.findUnique({
        where: { slug },
        include: { items: { include: { product: true } } },
      });
      if (!bundle) throw new AppError(404, "Bundle not found", "NOT_FOUND");
      if (bundle.status !== "ACTIVE") {
        throw new AppError(400, "Bundle is not available for purchase", "BUNDLE_UNAVAILABLE");
      }
      lines.push({
        itemType: "BUNDLE",
        bundleId: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        price: bundle.priceCents ?? 0,
        currency: bundle.currency,
        productSlugs: bundle.items.map((i) => i.product.slug),
        alreadyOwned: await userOwnsBundle(userId, bundle.id),
      });
    }
  }

  if (!lines.length) {
    throw new AppError(400, "No valid purchase items", "EMPTY_CART");
  }

  const hasBundle = lines.some((l) => l.itemType === "BUNDLE");
  const productCount = lines.filter((l) => l.itemType === "PRODUCT").length;
  let purchaseType: PurchaseType = "PRODUCT";
  if (hasBundle && productCount === 0 && lines.length === 1) purchaseType = "BUNDLE";
  else if (productCount > 1 || (hasBundle && productCount > 0)) purchaseType = "MULTI_PRODUCT";
  else if (hasBundle) purchaseType = "BUNDLE";
  else purchaseType = "PRODUCT";

  const currencies = [...new Set(lines.map((l) => l.currency))];
  if (currencies.length > 1) {
    throw new AppError(400, "Mixed currencies are not supported in one purchase", "CURRENCY_MISMATCH");
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.price * 1, 0);

  return { lines, purchaseType, currency: currencies[0] ?? "USD", totalAmount };
}

/**
 * Idempotent access provisioning from a purchase record.
 * Safe to call multiple times — never duplicates ProductAccess / BundleAccess.
 * Only provisions when payment is PAID or SIMULATED (or already COMPLETED historically).
 */
export async function provisionPurchaseAccess(purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: true },
  });
  if (!purchase) throw new AppError(404, "Purchase not found", "NOT_FOUND");

  const payable =
    purchase.paymentStatus === "PAID" ||
    purchase.paymentStatus === "SIMULATED" ||
    (purchase.status === "COMPLETED" && Boolean(purchase.accessProvisionedAt)) ||
    purchase.paymentStatus === "PAID";

  // Allow re-provision for already-completed historical purchases and paid ones
  const canProvision =
    purchase.paymentStatus === "PAID" ||
    purchase.paymentStatus === "SIMULATED" ||
    purchase.status === "COMPLETED";

  if (!canProvision) {
    throw new AppError(
      400,
      "Purchase is not paid — access cannot be provisioned yet",
      "PAYMENT_REQUIRED"
    );
  }
  void payable;

  const grantedProducts: Array<{ id: string; slug: string; name: string }> = [];
  const grantedBundles: Array<{ id: string; slug: string; name: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const item of purchase.items) {
      if (item.itemType === "PRODUCT" && item.productId) {
        await grantDirectProductAccess(tx, {
          userId: purchase.userId,
          productId: item.productId,
          source: "DIRECT",
        });
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          grantedProducts.push({ id: product.id, slug: product.slug, name: product.name });
        }
      } else if (item.itemType === "BUNDLE" && item.bundleId) {
        const result = await grantBundleAccess(tx, {
          userId: purchase.userId,
          bundleId: item.bundleId,
          source: "DIRECT",
        });
        const bundle = await tx.bundle.findUnique({
          where: { id: item.bundleId },
          include: { items: { include: { product: true } } },
        });
        if (bundle) {
          grantedBundles.push({ id: bundle.id, slug: bundle.slug, name: bundle.name });
          for (const bi of bundle.items) {
            grantedProducts.push({
              id: bi.product.id,
              slug: bi.product.slug,
              name: bi.product.name,
            });
          }
        }
        void result;
      }
    }

    if (!purchase.accessProvisionedAt) {
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { accessProvisionedAt: new Date(), status: "COMPLETED" },
      });
    }
  });

  const uniqueProducts = [...new Map(grantedProducts.map((p) => [p.id, p])).values()];

  return {
    purchaseId: purchase.id,
    code: purchase.code,
    products: uniqueProducts,
    bundles: grantedBundles,
  };
}

function redirectForLines(
  purchaseType: PurchaseType,
  lines: ResolvedLine[],
  products: Array<{ slug: string }>
) {
  let redirectTo = "/products";
  if (purchaseType === "PRODUCT" && lines[0]?.itemType === "PRODUCT") {
    redirectTo = `/products/${lines[0].slug}`;
  } else if (products.length === 1) {
    redirectTo = `/products/${products[0].slug}`;
  } else {
    redirectTo = `/purchase/confirmation`;
  }
  return redirectTo;
}

/** Create PENDING purchase with server-calculated totals (no access yet). */
export async function createPendingPurchase(userId: string, items: PurchaseRequestItem[]) {
  const resolved = await resolvePurchaseItems(userId, items);

  const purchase = await prisma.purchase.create({
    data: {
      code: makePurchaseCode(),
      userId,
      status: "PENDING",
      purchaseType: resolved.purchaseType,
      subtotalAmount: resolved.totalAmount,
      discountAmount: 0,
      totalAmount: resolved.totalAmount,
      currency: resolved.currency,
      paymentStatus: "PENDING",
      paymentNote: "Checkout started — awaiting payment verification.",
      items: {
        create: resolved.lines.map((line) =>
          line.itemType === "PRODUCT"
            ? {
                itemType: "PRODUCT" as const,
                productId: line.productId,
                quantity: 1,
                price: line.price,
              }
            : {
                itemType: "BUNDLE" as const,
                bundleId: line.bundleId,
                quantity: 1,
                price: line.price,
              }
        ),
      },
    },
    include: { items: true },
  });

  return {
    purchase,
    lines: resolved.lines,
    redirectTo: `/purchase/confirmation/${purchase.id}`,
  };
}

/** After verified payment: record event, mark paid, provision access (idempotent). */
export async function markPurchasePaidAndProvision(opts: {
  purchaseId: string;
  provider: string;
  sessionId?: string;
  paymentId?: string;
  amountCents: number;
  currency: string;
  eventId: string;
  eventType: string;
  rawSummary?: Record<string, unknown>;
}) {
  const purchase = await prisma.purchase.findUnique({ where: { id: opts.purchaseId } });
  if (!purchase) throw new AppError(404, "Purchase not found", "NOT_FOUND");

  // Already provisioned — still record event if new
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: {
      provider_eventId: { provider: opts.provider, eventId: opts.eventId },
    },
  });
  if (existingEvent && purchase.accessProvisionedAt) {
    return provisionPurchaseAccess(purchase.id);
  }

  await prisma.$transaction(async (tx) => {
    if (!existingEvent) {
      await tx.paymentEvent.create({
        data: {
          provider: opts.provider,
          eventId: opts.eventId,
          purchaseId: purchase.id,
          eventType: opts.eventType,
          amountVerified: true,
          summary: {
            amountCents: opts.amountCents,
            currency: opts.currency,
            ...(opts.rawSummary || {}),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        paymentStatus: opts.provider === "simulated" ? "SIMULATED" : "PAID",
        paymentProvider: opts.provider,
        providerSessionId: opts.sessionId || purchase.providerSessionId,
        providerPaymentId: opts.paymentId || purchase.providerPaymentId,
        paidAt: purchase.paidAt ?? new Date(),
        paymentNote: "Payment verified. Access provisioning.",
        status: purchase.status === "REFUNDED" ? "REFUNDED" : "COMPLETED",
      },
    });
  });

  const provisioned = await provisionPurchaseAccess(purchase.id);

  await writeAuditLog({
    actorId: purchase.userId,
    action: "purchase.payment_confirmed",
    entityType: "Purchase",
    entityId: purchase.id,
    metadata: {
      provider: opts.provider,
      eventId: opts.eventId,
      amount: opts.amountCents,
    },
  });
  await writeAuditLog({
    actorId: purchase.userId,
    action: "purchase.access_provisioned",
    entityType: "Purchase",
    entityId: purchase.id,
    metadata: {
      products: provisioned.products.map((p) => p.slug),
      bundles: provisioned.bundles.map((b) => b.slug),
    },
  });

  return provisioned;
}

export async function markPurchasePaymentFailed(opts: {
  purchaseId: string;
  status: "FAILED" | "CANCELLED";
  eventId: string;
  eventType: string;
  provider: string;
  rawSummary?: Record<string, unknown>;
}) {
  const purchase = await prisma.purchase.findUnique({ where: { id: opts.purchaseId } });
  if (!purchase) throw new AppError(404, "Purchase not found", "NOT_FOUND");
  if (purchase.accessProvisionedAt) {
    // Never revoke on a late failure event after success
    return purchase;
  }

  await prisma.paymentEvent.create({
    data: {
      provider: opts.provider,
      eventId: opts.eventId,
      purchaseId: purchase.id,
      eventType: opts.eventType,
      amountVerified: false,
      summary: opts.rawSummary as Prisma.InputJsonValue | undefined,
    },
  }).catch(() => undefined);

  return prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      paymentStatus: opts.status,
      status: opts.status === "CANCELLED" ? "CANCELLED" : "PENDING",
      cancelledAt: opts.status === "CANCELLED" ? new Date() : purchase.cancelledAt,
      paymentNote:
        opts.status === "CANCELLED"
          ? "Payment cancelled or expired."
          : "Payment failed. Access was not provisioned.",
    },
  });
}

/**
 * Legacy helper used by smoke tests — creates purchase and provisions immediately
 * via simulated payment semantics.
 */
export async function createCompletedPurchase(
  userId: string,
  items: PurchaseRequestItem[]
): Promise<{
  purchase: Purchase & { items: PurchaseItem[] };
  lines: ResolvedLine[];
  provisioned: Awaited<ReturnType<typeof provisionPurchaseAccess>>;
  redirectTo: string;
}> {
  const pending = await createPendingPurchase(userId, items);
  const provisioned = await markPurchasePaidAndProvision({
    purchaseId: pending.purchase.id,
    provider: "simulated",
    sessionId: `sim_sess_${pending.purchase.id}`,
    paymentId: `sim_pay_${pending.purchase.id}`,
    amountCents: pending.purchase.totalAmount,
    currency: pending.purchase.currency,
    eventId: `sim_evt_${pending.purchase.id}_${Date.now()}`,
    eventType: "simulated.completed",
  });

  const refreshed = await prisma.purchase.findUniqueOrThrow({
    where: { id: pending.purchase.id },
    include: { items: true },
  });

  return {
    purchase: refreshed,
    lines: pending.lines,
    provisioned,
    redirectTo: redirectForLines(refreshed.purchaseType, pending.lines, provisioned.products),
  };
}

export function serializePurchase(
  purchase: Purchase & {
    items: Array<
      PurchaseItem & {
        product?: { id: string; name: string; slug: string } | null;
        bundle?: { id: string; name: string; slug: string } | null;
      }
    >;
    user?: { id: string; email: string; firstName: string; lastName: string };
  }
) {
  return {
    id: purchase.id,
    code: purchase.code,
    status: purchase.status,
    purchaseType: purchase.purchaseType,
    totalAmount: purchase.totalAmount,
    subtotalAmount: (purchase as { subtotalAmount?: number }).subtotalAmount ?? purchase.totalAmount,
    discountAmount: (purchase as { discountAmount?: number }).discountAmount ?? 0,
    currency: purchase.currency,
    paymentStatus: purchase.paymentStatus,
    paymentNote: purchase.paymentNote,
    paymentProvider: (purchase as { paymentProvider?: string | null }).paymentProvider ?? null,
    providerSessionId: (purchase as { providerSessionId?: string | null }).providerSessionId ?? null,
    providerPaymentId: (purchase as { providerPaymentId?: string | null }).providerPaymentId ?? null,
    paidAt: (purchase as { paidAt?: Date | null }).paidAt ?? null,
    accessProvisionedAt: purchase.accessProvisionedAt,
    cancelledAt: purchase.cancelledAt,
    refundedAt: purchase.refundedAt,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
    user: purchase.user
      ? {
          id: purchase.user.id,
          email: purchase.user.email,
          firstName: purchase.user.firstName,
          lastName: purchase.user.lastName,
        }
      : undefined,
    items: purchase.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      quantity: item.quantity,
      price: item.price,
      product: item.product
        ? { id: item.product.id, name: item.product.name, slug: item.product.slug }
        : item.productId
          ? { id: item.productId, name: null, slug: null }
          : null,
      bundle: item.bundle
        ? { id: item.bundle.id, name: item.bundle.name, slug: item.bundle.slug }
        : item.bundleId
          ? { id: item.bundleId, name: null, slug: null }
          : null,
    })),
  };
}

export const purchaseIncludeDetail = {
  items: {
    include: {
      product: { select: { id: true, name: true, slug: true } },
      bundle: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.PurchaseInclude;
