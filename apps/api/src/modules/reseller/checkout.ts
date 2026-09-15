import { randomBytes } from "crypto";
import { prisma, type Prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { writeAuditLog } from "../audit/audit";
import { sendNotification } from "../email/notifications";
import { getPaymentProvider } from "../payments/provider";
import type { VerifiedPayment } from "../payments/types";
import { logWarn } from "../../lib/logger";
import { readCoveredProductIds } from "./entitlements";
import { publicBrandFor, whiteLabelAllowed } from "./branding";
import { isPublishedOffer } from "./offer-status";
import { recordOfferEvent } from "./portal";
import { RESELLER_REFUND_REVOKES_ACCESS } from "./refund-policy";

function saleCode() {
  return `RS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

type OfferSnapshot = {
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  brandName: string | null;
  productIds: string[];
  productSlugs: string[];
  bundleId: string | null;
};

function readSnapshot(value: unknown): OfferSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.productIds)) return null;
  return {
    slug: String(row.slug || ""),
    title: String(row.title || ""),
    priceCents: Number(row.priceCents || 0),
    currency: String(row.currency || "USD"),
    brandName: row.brandName ? String(row.brandName) : null,
    productIds: row.productIds.filter((id): id is string => typeof id === "string"),
    productSlugs: Array.isArray(row.productSlugs)
      ? row.productSlugs.filter((id): id is string => typeof id === "string")
      : [],
    bundleId: row.bundleId ? String(row.bundleId) : null,
  };
}

export async function loadSellablePublicOffer(slug: string) {
  const offer = await prisma.resellerOffer.findUnique({
    where: { slug },
    include: {
      reseller: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
      entitlement: true,
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
              status: true,
              resources: {
                where: { type: "SERVICE", isPublished: true },
                select: { title: true },
                orderBy: { sortOrder: "asc" },
                take: 8,
              },
            },
          },
        },
      },
    },
  });
  if (!offer || isArchived(offer.status) || !isPublishedOffer(offer.status)) {
    throw new AppError(404, "This offer is not available", "OFFER_UNAVAILABLE");
  }
  if (!offer.reseller.isActive) {
    throw new AppError(404, "This offer is not available", "OFFER_UNAVAILABLE");
  }
  if (offer.entitlement.status !== "ACTIVE" || offer.entitlement.userId !== offer.resellerUserId) {
    throw new AppError(403, "This offer is no longer available", "OFFER_UNAVAILABLE");
  }
  const covered = new Set(readCoveredProductIds(offer.entitlement.coveredProductIds));
  const products = offer.products
    .map((row) => row.product)
    .filter((product) => product.status === "PUBLISHED" && covered.has(product.id));
  if (!products.length) {
    throw new AppError(403, "This offer is no longer available", "OFFER_UNAVAILABLE");
  }
  return { offer, products };
}

function isArchived(status: string) {
  return status === "ARCHIVED";
}

export async function serializePublicOffer(loaded: Awaited<ReturnType<typeof loadSellablePublicOffer>>) {
  const { offer, products } = loaded;
  const branded = await whiteLabelAllowed(offer.entitlement);
  const brand = await publicBrandFor(offer.resellerUserId, branded);
  return {
    slug: offer.slug,
    title: offer.title,
    description: offer.description,
    salesCopy: offer.salesCopy,
    ctaText: offer.ctaText || "Purchase",
    priceCents: offer.priceCents,
    currency: offer.currency,
    brandName: branded ? brand?.brandName || offer.brandName : null,
    brandLogoUrl: branded ? brand?.logoUrl || offer.brandLogoUrl : null,
    brandAccent: branded ? brand?.primaryColor || offer.brandAccent : null,
    brand,
    attribution: "Access is provided through AI Enterprise Studio.",
    products: products.map((product) => ({
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      services: product.resources.map((resource) => resource.title),
    })),
  };
}

export async function startResellerCheckout(opts: { slug: string; buyerUserId: string }) {
  const loaded = await loadSellablePublicOffer(opts.slug);
  const { offer, products } = loaded;
  const buyer = await prisma.user.findUnique({ where: { id: opts.buyerUserId } });
  if (!buyer || !buyer.isActive) throw new AppError(401, "Please log in", "UNAUTHORIZED");
  if (buyer.email === offer.reseller.email || buyer.id === offer.resellerUserId) {
    throw new AppError(400, "A reseller cannot purchase their own offer", "SELF_PURCHASE");
  }

  await recordOfferEvent(offer.id, offer.resellerUserId, "CHECKOUT_START");
  const productIds = products.map((product) => product.id);
  const snapshot: OfferSnapshot = {
    slug: offer.slug,
    title: offer.title,
    priceCents: offer.priceCents,
    currency: offer.currency,
    brandName: offer.brandName,
    productIds,
    productSlugs: products.map((product) => product.slug),
    bundleId: offer.entitlement.bundleId,
  };

  const customer = await prisma.resellerCustomer.upsert({
    where: { resellerUserId_email: { resellerUserId: offer.resellerUserId, email: buyer.email } },
    update: {
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      userId: buyer.id,
      status: "ACTIVE",
    },
    create: {
      resellerUserId: offer.resellerUserId,
      email: buyer.email,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      userId: buyer.id,
      status: "ACTIVE",
    },
  });

  const sale = await prisma.resellerSale.create({
    data: {
      code: saleCode(),
      offerId: offer.id,
      resellerUserId: offer.resellerUserId,
      customerId: customer.id,
      productId: productIds.length === 1 ? productIds[0] : null,
      bundleId: snapshot.bundleId,
      status: "PENDING",
      amountCents: offer.priceCents,
      currency: offer.currency,
      paymentStatus: "PENDING",
      snapshot,
    },
  });

  await writeAuditLog({
    actorId: buyer.id,
    actorEmail: buyer.email,
    action: "reseller.checkout.created",
    entityType: "ResellerSale",
    entityId: sale.id,
    metadata: { code: sale.code, amountCents: sale.amountCents, currency: sale.currency },
  });

  const provider = getPaymentProvider();
  let checkout;
  try {
    checkout = await provider.createCheckout({
      purchaseId: sale.id,
      purchaseCode: sale.code,
      currency: sale.currency,
      amountCents: sale.amountCents,
      customerEmail: buyer.email,
      successUrl: `${env.APP_URL}/r/${offer.slug}/confirmation/${sale.code}`,
      cancelUrl: `${env.APP_URL}/r/${offer.slug}/confirmation/${sale.code}`,
      lines: [
        {
          name: offer.title,
          amountCents: sale.amountCents,
          quantity: 1,
        },
      ],
      metadata: {
        kind: "reseller_sale",
        resellerSaleId: sale.id,
        resellerSaleCode: sale.code,
      },
    });
  } catch (err) {
    await prisma.resellerSale.update({
      where: { id: sale.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
        failureReason: "Unable to create checkout",
        cancelledAt: new Date(),
      },
    });
    await writeAuditLog({
      actorId: buyer.id,
      action: "reseller.payment.session_failed",
      entityType: "ResellerSale",
      entityId: sale.id,
      metadata: { error: err instanceof Error ? err.message : "unknown" },
    });
    throw new AppError(502, "Unable to create checkout", "CHECKOUT_FAILED");
  }

  await prisma.resellerSale.update({
    where: { id: sale.id },
    data: {
      paymentProvider: checkout.provider,
      checkoutReference: checkout.sessionId,
      paymentStatus: checkout.alreadyPaid ? "PENDING" : "REQUIRES_PAYMENT",
    },
  });

  await writeAuditLog({
    actorId: buyer.id,
    action: "reseller.payment.initiated",
    entityType: "ResellerSale",
    entityId: sale.id,
    metadata: { provider: checkout.provider, amountCents: sale.amountCents, currency: sale.currency },
  });

  if (checkout.alreadyPaid) {
    const verified = await applyVerifiedResellerPayment({
      resellerSaleId: sale.id,
      provider: checkout.provider,
      eventId: `sim_complete_${sale.id}`,
      eventType: "simulated.completed",
      sessionId: checkout.sessionId,
      paymentId: `sim_pay_${sale.id}`,
      amountCents: sale.amountCents,
      currency: sale.currency,
      status: "paid",
    });
    return {
      mode: "completed" as const,
      saleCode: sale.code,
      status: verified.status,
      accessReady: verified.accessReady,
      checkoutUrl: null as string | null,
      confirmationPath: `/r/${offer.slug}/confirmation/${sale.code}`,
    };
  }

  return {
    mode: "checkout" as const,
    saleCode: sale.code,
    status: "PENDING" as const,
    accessReady: false,
    checkoutUrl: checkout.checkoutUrl,
    confirmationPath: `/r/${offer.slug}/confirmation/${sale.code}`,
  };
}

async function grantUseAccess(
  tx: Prisma.TransactionClient,
  opts: { saleId: string; userId: string; productIds: string[] }
) {
  for (const productId of opts.productIds) {
    const existingAccess = await tx.productAccess.findFirst({
      where: {
        userId: opts.userId,
        productId,
        status: "ACTIVE",
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    let productAccessId = existingAccess?.id ?? null;
    if (!productAccessId) {
      const inactive = await tx.productAccess.findFirst({
        where: { userId: opts.userId, productId, bundleId: null },
      });
      if (inactive) {
        const updated = await tx.productAccess.update({
          where: { id: inactive.id },
          data: { status: "ACTIVE", source: inactive.source === "ADMIN_GRANT" ? "ADMIN_GRANT" : "RESELLER", endsAt: null },
        });
        productAccessId = updated.id;
      } else {
        const created = await tx.productAccess.create({
          data: { userId: opts.userId, productId, source: "RESELLER", status: "ACTIVE" },
        });
        productAccessId = created.id;
      }
    }
    await tx.resellerCustomerAccess.upsert({
      where: { saleId_productId: { saleId: opts.saleId, productId } },
      update: { productAccessId, userId: opts.userId },
      create: { saleId: opts.saleId, userId: opts.userId, productId, productAccessId },
    });
  }
}

export async function applyVerifiedResellerPayment(input: {
  resellerSaleId: string;
  provider: string;
  eventId: string;
  eventType: string;
  sessionId?: string | null;
  paymentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status: VerifiedPayment["status"];
}) {
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: { provider_eventId: { provider: input.provider, eventId: input.eventId } },
  });
  if (existingEvent) {
    const sale = await prisma.resellerSale.findUnique({ where: { id: input.resellerSaleId } });
    return {
      duplicate: true,
      status: sale?.status ?? "PENDING",
      accessReady: Boolean(sale?.accessProvisionedAt),
      saleCode: sale?.code ?? "",
    };
  }

  const sale = await prisma.resellerSale.findUnique({
    where: { id: input.resellerSaleId },
    include: { customer: true, reseller: { select: { email: true } }, offer: { select: { title: true } } },
  });
  if (!sale) throw new AppError(404, "Reseller sale not found", "SALE_NOT_FOUND");

  if (input.status === "paid") {
    if (input.amountCents != null && input.amountCents !== sale.amountCents) {
      await recordAnomaly(sale, input, "AMOUNT_MISMATCH", sale.amountCents, input.amountCents);
      throw new AppError(400, "Payment amount mismatch", "AMOUNT_MISMATCH");
    }
    if (input.currency && input.currency.toLowerCase() !== sale.currency.toLowerCase()) {
      await recordAnomaly(sale, input, "CURRENCY_MISMATCH", sale.currency, input.currency);
      throw new AppError(400, "Payment currency mismatch", "CURRENCY_MISMATCH");
    }

    const snapshot = readSnapshot(sale.snapshot);
    const productIds = snapshot?.productIds ?? [];
    if (!productIds.length || !sale.customer.userId) {
      throw new AppError(409, "Access provisioning pending", "PROVISION_INCOMPLETE");
    }

    await prisma.$transaction(async (tx) => {
      if (sale.status === "PENDING" || sale.status === "FAILED") {
        await tx.resellerSale.update({
          where: { id: sale.id },
          data: {
            status: "PAID",
            paymentStatus: input.provider === "simulated" ? "SIMULATED" : "PAID",
            paymentProvider: input.provider,
            paymentReference: input.paymentId || sale.paymentReference,
            checkoutReference: input.sessionId || sale.checkoutReference,
            paidAt: sale.paidAt ?? new Date(),
            failureReason: null,
          },
        });
      }
      await grantUseAccess(tx, { saleId: sale.id, userId: sale.customer.userId!, productIds });
      await tx.resellerSale.update({
        where: { id: sale.id },
        data: { accessProvisionedAt: new Date(), status: "PAID" },
      });
      await tx.paymentEvent.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          resellerSaleId: sale.id,
          eventType: input.eventType,
          amountVerified: true,
          summary: { amountCents: sale.amountCents, currency: sale.currency },
        },
      });
    });

    await writeAuditLog({
      action: "reseller.sale.paid",
      entityType: "ResellerSale",
      entityId: sale.id,
      metadata: { code: sale.code, provider: input.provider },
    });
    await writeAuditLog({
      action: "reseller.access.provisioned",
      entityType: "ResellerSale",
      entityId: sale.id,
      metadata: { productCount: productIds.length },
    });

    await sendNotification({
      type: "reseller_purchase_confirmation",
      to: sale.customer.email,
      data: { saleCode: sale.code, offerTitle: sale.offer.title, amountCents: sale.amountCents, currency: sale.currency },
    });
    await sendNotification({
      type: "reseller_new_sale",
      to: sale.reseller.email,
      data: { saleCode: sale.code, offerTitle: sale.offer.title, amountCents: sale.amountCents, currency: sale.currency },
    });

    return { duplicate: false, status: "PAID" as const, accessReady: true, saleCode: sale.code };
  }

  if (sale.status === "PENDING") {
    await prisma.resellerSale.update({
      where: { id: sale.id },
      data: {
        status: input.status === "cancelled" ? "CANCELLED" : "FAILED",
        paymentStatus: input.status === "cancelled" ? "CANCELLED" : "FAILED",
        cancelledAt: input.status === "cancelled" ? new Date() : null,
        failureReason: input.status === "cancelled" ? "Payment cancelled" : "Payment failed",
      },
    });
  }
  await prisma.paymentEvent.create({
    data: {
      provider: input.provider,
      eventId: input.eventId,
      resellerSaleId: sale.id,
      eventType: input.eventType,
      amountVerified: false,
      summary: { status: input.status },
    },
  });
  await writeAuditLog({
    action: input.status === "cancelled" ? "reseller.sale.cancelled" : "reseller.payment.failed",
    entityType: "ResellerSale",
    entityId: sale.id,
  });
  return { duplicate: false, status: input.status === "cancelled" ? "CANCELLED" : "FAILED", accessReady: false, saleCode: sale.code };
}

async function recordAnomaly(
  sale: { id: string; status: string },
  input: { provider: string; eventId: string; eventType: string },
  code: string,
  expected: unknown,
  received: unknown
) {
  await prisma.paymentEvent.create({
    data: {
      provider: input.provider,
      eventId: input.eventId,
      resellerSaleId: sale.id,
      eventType: input.eventType,
      amountVerified: false,
      summary: {
        code,
        expected: expected == null ? null : String(expected),
        received: received == null ? null : String(received),
      },
    },
  });
  if (sale.status === "PENDING") {
    await prisma.resellerSale.update({
      where: { id: sale.id },
      data: { paymentStatus: code, failureReason: code, status: "FAILED" },
    });
  }
  await writeAuditLog({
    action: "reseller.payment.rejected",
    entityType: "ResellerSale",
    entityId: sale.id,
    metadata: { code, ignoredBecausePaid: sale.status === "PAID" || sale.status === "COMPLETED" },
  });
  logWarn("reseller.payment.rejected", { saleId: sale.id, code });
}

export async function getResellerCheckoutStatus(code: string, userId: string, role: string) {
  const sale = await prisma.resellerSale.findUnique({
    where: { code },
    include: {
      offer: { select: { title: true, slug: true } },
      customer: { select: { userId: true, email: true, firstName: true, lastName: true } },
      product: { select: { name: true, slug: true } },
      bundle: { select: { name: true, slug: true } },
      access: { select: { productId: true, productAccessId: true } },
    },
  });
  if (!sale) throw new AppError(404, "Checkout not found", "NOT_FOUND");
  const allowed = role === "ADMIN" || sale.resellerUserId === userId || sale.customer.userId === userId;
  if (!allowed) throw new AppError(404, "Checkout not found", "NOT_FOUND");

  if ((sale.status === "PAID" || sale.status === "COMPLETED") && !sale.accessProvisionedAt) {
    const snapshot = readSnapshot(sale.snapshot);
    if (snapshot && sale.customer.userId) {
      await prisma.$transaction(async (tx) => {
        await grantUseAccess(tx, { saleId: sale.id, userId: sale.customer.userId!, productIds: snapshot.productIds });
        await tx.resellerSale.update({ where: { id: sale.id }, data: { accessProvisionedAt: new Date(), status: "PAID" } });
      });
    }
  }

  const fresh = await prisma.resellerSale.findUniqueOrThrow({
    where: { id: sale.id },
    include: {
      offer: { select: { title: true, slug: true } },
      product: { select: { name: true, slug: true } },
      bundle: { select: { name: true, slug: true } },
    },
  });
  const snapshot = readSnapshot(fresh.snapshot);
  return {
    code: fresh.code,
    status: fresh.status === "COMPLETED" ? "PAID" : fresh.status,
    paymentStatus: fresh.paymentStatus,
    offerTitle: fresh.offer.title,
    offerSlug: fresh.offer.slug,
    amountCents: fresh.amountCents,
    currency: fresh.currency,
    accessReady: Boolean(fresh.accessProvisionedAt),
    productSlug: fresh.product?.slug || snapshot?.productSlugs[0] || null,
    verifying: fresh.status === "PENDING",
  };
}

export async function cancelResellerCheckout(code: string, userId: string) {
  const sale = await prisma.resellerSale.findUnique({
    where: { code },
    include: { customer: { select: { userId: true } } },
  });
  if (!sale || sale.customer.userId !== userId) throw new AppError(404, "Checkout not found", "NOT_FOUND");
  if (sale.status !== "PENDING") return { status: sale.status };
  await prisma.resellerSale.update({
    where: { id: sale.id },
    data: { status: "CANCELLED", paymentStatus: "CANCELLED", cancelledAt: new Date() },
  });
  await writeAuditLog({
    actorId: userId,
    action: "reseller.sale.cancelled",
    entityType: "ResellerSale",
    entityId: sale.id,
  });
  return { status: "CANCELLED" };
}

export async function refundResellerSale(saleId: string, actorId: string | undefined, refundReference?: string | null) {
  const sale = await prisma.resellerSale.findUnique({
    where: { id: saleId },
    include: { access: true, customer: true },
  });
  if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");
  if (sale.status !== "PAID" && sale.status !== "COMPLETED") {
    throw new AppError(400, "Only a paid sale can be refunded", "INVALID_STATE");
  }
  await prisma.resellerSale.update({
    where: { id: sale.id },
    data: {
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundedAt: new Date(),
      refundReference: refundReference || null,
    },
  });
  if (RESELLER_REFUND_REVOKES_ACCESS && sale.customer.userId) {
    for (const row of sale.access) {
      const otherPaid = await prisma.resellerCustomerAccess.findFirst({
        where: {
          userId: sale.customer.userId,
          productId: row.productId,
          saleId: { not: sale.id },
          sale: { status: { in: ["PAID", "COMPLETED"] } },
        },
      });
      if (otherPaid || !row.productAccessId) continue;
      const access = await prisma.productAccess.findUnique({ where: { id: row.productAccessId } });
      if (access?.source === "RESELLER" && access.status === "ACTIVE") {
        await prisma.productAccess.update({ where: { id: access.id }, data: { status: "REVOKED" } });
      }
    }
  }
  await writeAuditLog({
    actorId,
    action: "reseller.sale.refunded",
    entityType: "ResellerSale",
    entityId: sale.id,
    metadata: { refundReference: refundReference || null, revokesAccess: RESELLER_REFUND_REVOKES_ACCESS },
  });
  return { status: "REFUNDED" };
}

export async function handleResellerPaymentWebhook(verified: VerifiedPayment) {
  const resellerSaleId = verified.resellerSaleId;
  const sale =
    (resellerSaleId ? await prisma.resellerSale.findUnique({ where: { id: resellerSaleId } }) : null) ||
    (verified.sessionId
      ? await prisma.resellerSale.findFirst({ where: { checkoutReference: verified.sessionId } })
      : null);
  if (!sale) return null;
  return applyVerifiedResellerPayment({
    resellerSaleId: sale.id,
    provider: verified.provider,
    eventId: verified.eventId,
    eventType: verified.eventType,
    sessionId: verified.sessionId,
    paymentId: verified.paymentId,
    amountCents: verified.amountCents,
    currency: verified.currency,
    status: verified.status,
  });
}
