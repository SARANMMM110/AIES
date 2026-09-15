import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma, type Prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { writeAuditLog } from "../audit/audit";
import { logInfo } from "../../lib/logger";
import { readCoveredProductIds } from "./entitlements";
import { isPublishedOffer } from "./offer-status";

function saleCode() {
  return `RS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type Buyer = {
  email: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  notes?: string | null;
};

function cleanName(value: string, label: string) {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new AppError(400, `${label} is required`, "INVALID_CUSTOMER");
  }
  return trimmed;
}

function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "A valid customer email is required", "INVALID_CUSTOMER");
  }
  return email;
}

async function loadSellableOffer(offerId: string, resellerUserId?: string) {
  const offer = await prisma.resellerOffer.findFirst({
    where: {
      id: offerId,
      ...(resellerUserId ? { resellerUserId } : {}),
    },
    include: {
      reseller: { select: { id: true, email: true } },
      entitlement: true,
      products: { select: { productId: true } },
    },
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  if (!isPublishedOffer(offer.status)) {
    throw new AppError(400, "This offer is not available for sale", "OFFER_UNAVAILABLE");
  }
  if (offer.entitlement.status !== "ACTIVE" || offer.entitlement.userId !== offer.resellerUserId) {
    throw new AppError(403, "Reseller rights are not active for this offer", "RESELLER_ENTITLEMENT_REQUIRED");
  }
  const covered = new Set(readCoveredProductIds(offer.entitlement.coveredProductIds));
  const productIds = offer.products.map((row) => row.productId).filter((id) => covered.has(id));
  if (!productIds.length) {
    throw new AppError(403, "Offer is outside the reseller's entitlement", "RESELLER_SCOPE");
  }
  return { offer, productIds };
}

async function upsertCustomer(
  tx: Prisma.TransactionClient,
  resellerUserId: string,
  buyer: Buyer
) {
  const email = cleanEmail(buyer.email);
  const firstName = cleanName(buyer.firstName, "First name");
  const lastName = cleanName(buyer.lastName, "Last name");
  const existing = await tx.resellerCustomer.findUnique({
    where: { resellerUserId_email: { resellerUserId, email } },
  });
  if (existing) {
    return tx.resellerCustomer.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        company: buyer.company?.trim() || existing.company,
        notes: buyer.notes?.trim() || existing.notes,
      },
    });
  }
  return tx.resellerCustomer.create({
    data: {
      resellerUserId,
      email,
      firstName,
      lastName,
      company: buyer.company?.trim() || null,
      notes: buyer.notes?.trim() || null,
    },
  });
}

async function ensureEndUser(
  tx: Prisma.TransactionClient,
  customer: { id: string; email: string; firstName: string; lastName: string; userId: string | null },
  linkedUserId?: string | null
) {
  if (linkedUserId) {
    const linked = await tx.user.findUnique({ where: { id: linkedUserId } });
    if (!linked || linked.email !== customer.email || !linked.isActive) {
      throw new AppError(403, "Sign in with the purchasing email to complete this sale", "SIGN_IN_REQUIRED");
    }
    await tx.resellerCustomer.update({
      where: { id: customer.id },
      data: { userId: linked.id, status: "ACTIVE" },
    });
    return { userId: linked.id, activationToken: null as string | null, createdUser: false };
  }

  const existingUser = await tx.user.findUnique({ where: { email: customer.email } });
  if (existingUser) {
    if (!existingUser.isActive) {
      throw new AppError(400, "This customer account is inactive", "USER_INACTIVE");
    }
    await tx.resellerCustomer.update({
      where: { id: customer.id },
      data: { userId: existingUser.id, status: "ACTIVE" },
    });
    return { userId: existingUser.id, activationToken: null as string | null, createdUser: false };
  }

  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), env.BCRYPT_SALT_ROUNDS);
  const user = await tx.user.create({
    data: {
      email: customer.email,
      passwordHash,
      firstName: customer.firstName,
      lastName: customer.lastName,
      role: "USER",
    },
  });
  const activationToken = randomBytes(24).toString("hex");
  await tx.resellerCustomer.update({
    where: { id: customer.id },
    data: {
      userId: user.id,
      status: "INVITED",
      activationTokenHash: hashToken(activationToken),
      activationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return { userId: user.id, activationToken, createdUser: true };
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
          data: { status: "ACTIVE", source: "RESELLER", endsAt: null },
        });
        productAccessId = updated.id;
      } else {
        const created = await tx.productAccess.create({
          data: {
            userId: opts.userId,
            productId,
            source: "RESELLER",
            status: "ACTIVE",
          },
        });
        productAccessId = created.id;
      }
    }

    await tx.resellerCustomerAccess.upsert({
      where: { saleId_productId: { saleId: opts.saleId, productId } },
      update: { productAccessId, userId: opts.userId },
      create: {
        saleId: opts.saleId,
        userId: opts.userId,
        productId,
        productAccessId,
      },
    });
  }
}

/**
 * Record a reseller sale and grant ProductAccess only.
 * Does not create a ResellerEntitlement for the end customer.
 */
export async function fulfillResellerSale(opts: {
  offerId: string;
  buyer: Buyer;
  paymentStatus: "SIMULATED" | "RECORDED";
  paymentNote: string;
  actorUserId?: string | null;
  resellerUserId?: string;
  authenticatedBuyerId?: string | null;
}) {
  const { offer, productIds } = await loadSellableOffer(opts.offerId, opts.resellerUserId);
  const email = cleanEmail(opts.buyer.email);
  if (email === offer.reseller.email) {
    throw new AppError(400, "A reseller cannot purchase their own offer", "SELF_PURCHASE");
  }

  if (opts.authenticatedBuyerId) {
    const buyerUser = await prisma.user.findUnique({ where: { id: opts.authenticatedBuyerId } });
    if (!buyerUser || buyerUser.email !== email) {
      throw new AppError(403, "Sign in with the purchasing email to complete this sale", "SIGN_IN_REQUIRED");
    }
  } else {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && opts.paymentStatus === "SIMULATED") {
      throw new AppError(
        409,
        "An account already exists for this email. Sign in to complete the purchase.",
        "SIGN_IN_REQUIRED"
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const customer = await upsertCustomer(tx, offer.resellerUserId, opts.buyer);
    const endUser = await ensureEndUser(
      tx,
      customer,
      opts.authenticatedBuyerId && opts.paymentStatus === "SIMULATED" ? opts.authenticatedBuyerId : null
    );

    const sale = await tx.resellerSale.create({
      data: {
        code: saleCode(),
        offerId: offer.id,
        resellerUserId: offer.resellerUserId,
        customerId: customer.id,
        status: "PAID",
        paidAt: new Date(),
        paymentProvider: opts.paymentStatus === "RECORDED" ? "recorded" : "simulated",
        amountCents: offer.priceCents,
        currency: offer.currency,
        paymentStatus: opts.paymentStatus,
        paymentNote: opts.paymentNote,
        accessProvisionedAt: new Date(),
      },
    });

    await grantUseAccess(tx, {
      saleId: sale.id,
      userId: endUser.userId,
      productIds,
    });

    return { sale, customer, endUser };
  });

  if (result.endUser.activationToken) {
    logInfo("reseller.activation_issued", {
      saleCode: result.sale.code,
      email,
    });
  }

  await writeAuditLog({
    actorId: opts.actorUserId ?? offer.resellerUserId,
    action: "reseller.sale.fulfilled",
    entityType: "ResellerSale",
    entityId: result.sale.id,
    metadata: {
      code: result.sale.code,
      offerId: offer.id,
      paymentStatus: opts.paymentStatus,
      productCount: productIds.length,
    },
  });

  return {
    sale: {
      id: result.sale.id,
      code: result.sale.code,
      amountCents: result.sale.amountCents,
      currency: result.sale.currency,
      paymentStatus: result.sale.paymentStatus,
      status: result.sale.status,
    },
    customer: {
      id: result.customer.id,
      email: result.customer.email,
      firstName: result.customer.firstName,
      lastName: result.customer.lastName,
    },
    accessGranted: productIds.length,
    resellerRightsGranted: false,
    createdUser: result.endUser.createdUser,
    activationPath: result.endUser.activationToken
      ? `/reseller/activate?token=${result.endUser.activationToken}`
      : null,
  };
}

export async function activateResellerCustomer(token: string, password: string) {
  if (password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters", "WEAK_PASSWORD");
  }
  const customer = await prisma.resellerCustomer.findUnique({
    where: { activationTokenHash: hashToken(token) },
  });
  if (!customer || !customer.userId || !customer.activationExpiresAt || customer.activationExpiresAt < new Date()) {
    throw new AppError(400, "Activation link is invalid or expired", "INVALID_TOKEN");
  }
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: customer.userId },
      data: { passwordHash },
    }),
    prisma.resellerCustomer.update({
      where: { id: customer.id },
      data: {
        status: "ACTIVE",
        activationTokenHash: null,
        activationExpiresAt: null,
      },
    }),
  ]);
  return { email: customer.email };
}
