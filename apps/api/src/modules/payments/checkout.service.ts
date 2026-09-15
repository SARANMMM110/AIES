import { prisma } from "@aes/database";
import type { Prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { writeAuditLog } from "../audit/audit";
import { sendNotification } from "../email/notifications";
import { logInfo, logWarn } from "../../lib/logger";
import {
  createPendingPurchase,
  markPurchasePaidAndProvision,
  markPurchasePaymentFailed,
  provisionPurchaseAccess,
  serializePurchase,
  type PurchaseRequestItem,
} from "../purchase/purchase-service";
import { getPaymentProvider } from "./provider";
import { handleResellerPaymentWebhook } from "../reseller/checkout";

export async function startCheckout(opts: {
  userId: string;
  userEmail: string;
  items: PurchaseRequestItem[];
  actorEmail?: string | null;
}) {
  const pending = await createPendingPurchase(opts.userId, opts.items);
  const provider = getPaymentProvider();

  const successUrl = `${env.APP_URL}/purchase/confirmation/${pending.purchase.id}?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${env.APP_URL}/purchase/confirmation/${pending.purchase.id}?cancelled=1`;

  const checkout = await provider.createCheckout({
    purchaseId: pending.purchase.id,
    purchaseCode: pending.purchase.code,
    currency: pending.purchase.currency,
    amountCents: pending.purchase.totalAmount,
    customerEmail: opts.userEmail,
    successUrl,
    cancelUrl,
    lines: pending.lines.map((line) => ({
      name: line.name,
      amountCents: line.price,
      quantity: 1,
      productSlug: line.itemType === "PRODUCT" ? line.slug : undefined,
      bundleSlug: line.itemType === "BUNDLE" ? line.slug : undefined,
    })),
  });

  await prisma.purchase.update({
    where: { id: pending.purchase.id },
    data: {
      paymentProvider: checkout.provider,
      providerSessionId: checkout.sessionId,
      paymentStatus: checkout.alreadyPaid ? "PAID" : "REQUIRES_PAYMENT",
      paymentNote: checkout.alreadyPaid
        ? "Simulated payment confirmed — access provisioning."
        : "Awaiting payment provider confirmation.",
    },
  });

  await writeAuditLog({
    actorId: opts.userId,
    actorEmail: opts.actorEmail,
    action: "purchase.checkout_started",
    entityType: "Purchase",
    entityId: pending.purchase.id,
    metadata: {
      provider: checkout.provider,
      amount: pending.purchase.totalAmount,
      currency: pending.purchase.currency,
    },
  });

  if (checkout.alreadyPaid) {
    const provisioned = await markPurchasePaidAndProvision({
      purchaseId: pending.purchase.id,
      provider: checkout.provider,
      sessionId: checkout.sessionId,
      paymentId: `sim_pay_${pending.purchase.id}`,
      amountCents: pending.purchase.totalAmount,
      currency: pending.purchase.currency,
      eventId: `sim_complete_${pending.purchase.id}_${Date.now()}`,
      eventType: "simulated.completed",
    });

    await sendNotification({
      type: "purchase_confirmation",
      to: opts.userEmail,
      data: {
        purchaseCode: pending.purchase.code,
        totalAmount: pending.purchase.totalAmount,
        currency: pending.purchase.currency,
      },
    });

    const refreshed = await prisma.purchase.findUniqueOrThrow({
      where: { id: pending.purchase.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            bundle: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return {
      mode: "completed" as const,
      purchase: serializePurchase(refreshed),
      lines: pending.lines,
      grantedProducts: provisioned.products,
      grantedBundles: provisioned.bundles,
      checkoutUrl: null as string | null,
      redirectTo: pending.redirectTo,
      paymentStatus: refreshed.paymentStatus,
      paymentNote: refreshed.paymentNote,
    };
  }

  const refreshed = await prisma.purchase.findUniqueOrThrow({
    where: { id: pending.purchase.id },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
          bundle: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return {
    mode: "checkout" as const,
    purchase: serializePurchase(refreshed),
    lines: pending.lines,
    grantedProducts: [] as Array<{ id: string; slug: string; name: string }>,
    grantedBundles: [] as Array<{ id: string; slug: string; name: string }>,
    checkoutUrl: checkout.checkoutUrl,
    redirectTo: `/purchase/confirmation/${pending.purchase.id}`,
    paymentStatus: refreshed.paymentStatus,
    paymentNote: refreshed.paymentNote,
  };
}

export async function handlePaymentWebhook(opts: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
}) {
  const provider = getPaymentProvider();
  const verified = await provider.verifyWebhook(opts);

  if (verified.status === "ignored") {
    return { ok: true, ignored: true, eventType: verified.eventType };
  }

  // Idempotency — same provider event never processes twice
  const existing = await prisma.paymentEvent.findUnique({
    where: {
      provider_eventId: { provider: verified.provider, eventId: verified.eventId },
    },
  });
  if (existing) {
    logInfo("payment.webhook.duplicate", { eventId: verified.eventId });
    return { ok: true, duplicate: true, eventType: verified.eventType };
  }

  if (verified.resellerSaleId) {
    const reseller = await handleResellerPaymentWebhook(verified);
    if (!reseller) {
      await writeAuditLog({
        action: "reseller.payment.rejected",
        entityType: "ResellerSale",
        entityId: verified.resellerSaleId,
        metadata: { code: "UNKNOWN_SALE", eventType: verified.eventType },
      });
      throw new AppError(404, "Reseller sale not found for payment event", "SALE_NOT_FOUND");
    }
    return { ok: true, resellerSale: true, duplicate: reseller.duplicate, status: reseller.status };
  }

  if (verified.sessionId) {
    const linked = await prisma.resellerSale.findFirst({
      where: { checkoutReference: verified.sessionId },
      select: { id: true },
    });
    if (linked) {
      const reseller = await handleResellerPaymentWebhook({ ...verified, resellerSaleId: linked.id });
      if (reseller) {
        return { ok: true, resellerSale: true, duplicate: reseller.duplicate, status: reseller.status };
      }
    }
  }

  let purchase =
    (verified.purchaseId
      ? await prisma.purchase.findUnique({ where: { id: verified.purchaseId } })
      : null) ||
    (verified.sessionId
      ? await prisma.purchase.findFirst({
          where: { providerSessionId: verified.sessionId },
        })
      : null);

  if (!purchase) {
    await prisma.paymentEvent.create({
      data: {
        provider: verified.provider,
        eventId: verified.eventId,
        eventType: verified.eventType,
        amountVerified: false,
        summary: verified.rawSummary as Prisma.InputJsonValue,
      },
    });
    logWarn("payment.webhook.purchase_missing", { eventId: verified.eventId });
    throw new AppError(404, "Purchase not found for payment event", "PURCHASE_NOT_FOUND");
  }

  if (verified.status === "paid") {
    if (
      verified.amountCents != null &&
      verified.amountCents !== purchase.totalAmount
    ) {
      await prisma.paymentEvent.create({
        data: {
          provider: verified.provider,
          eventId: verified.eventId,
          purchaseId: purchase.id,
          eventType: verified.eventType,
          amountVerified: false,
          summary: {
            ...verified.rawSummary,
            expected: purchase.totalAmount,
            received: verified.amountCents,
          } as Prisma.InputJsonValue,
        },
      });
      throw new AppError(400, "Payment amount mismatch", "AMOUNT_MISMATCH");
    }
    if (
      verified.currency &&
      verified.currency.toLowerCase() !== purchase.currency.toLowerCase()
    ) {
      throw new AppError(400, "Payment currency mismatch", "CURRENCY_MISMATCH");
    }

    const result = await markPurchasePaidAndProvision({
      purchaseId: purchase.id,
      provider: verified.provider,
      sessionId: verified.sessionId || purchase.providerSessionId || undefined,
      paymentId: verified.paymentId || undefined,
      amountCents: purchase.totalAmount,
      currency: purchase.currency,
      eventId: verified.eventId,
      eventType: verified.eventType,
      rawSummary: verified.rawSummary,
    });

    const user = await prisma.user.findUnique({ where: { id: purchase.userId } });
    if (user) {
      await sendNotification({
        type: "purchase_confirmation",
        to: user.email,
        data: {
          purchaseCode: purchase.code,
          totalAmount: purchase.totalAmount,
          currency: purchase.currency,
        },
      });
      await sendNotification({
        type: "access_granted",
        to: user.email,
        data: {
          purchaseCode: purchase.code,
          productCount: result.products.length,
        },
      });
    }

    return { ok: true, provisioned: true, purchaseId: purchase.id };
  }

  await markPurchasePaymentFailed({
    purchaseId: purchase.id,
    status: verified.status === "cancelled" ? "CANCELLED" : "FAILED",
    eventId: verified.eventId,
    eventType: verified.eventType,
    provider: verified.provider,
    rawSummary: verified.rawSummary,
  });

  return { ok: true, failed: true, purchaseId: purchase.id };
}

/** Poll / confirm after return URL (does not trust client; re-checks provider session when Stripe). */
export async function refreshPurchasePaymentStatus(purchaseId: string, userId: string, role: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true } },
          bundle: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!purchase) throw new AppError(404, "Purchase not found", "NOT_FOUND");
  if (role !== "ADMIN" && purchase.userId !== userId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }

  // If already provisioned, return as-is
  if (purchase.accessProvisionedAt) {
    return {
      purchase: serializePurchase(purchase),
      accessReady: true,
      verifying: false,
    };
  }

  // Simulated / already paid path
  if (purchase.paymentStatus === "PAID" && !purchase.accessProvisionedAt) {
    await provisionPurchaseAccess(purchase.id);
    const refreshed = await prisma.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            bundle: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return {
      purchase: serializePurchase(refreshed),
      accessReady: Boolean(refreshed.accessProvisionedAt),
      verifying: false,
    };
  }

  return {
    purchase: serializePurchase(purchase),
    accessReady: false,
    verifying: purchase.paymentStatus === "REQUIRES_PAYMENT" || purchase.status === "PENDING",
  };
}
