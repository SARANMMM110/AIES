import { randomBytes } from "crypto";
import { prisma, type ResellerOfferStatus } from "@aes/database";
import { AppError } from "../../utils/errors";
import { RESELLER_PRICE_MAX_CENTS } from "./constants";
import { readCoveredProductIds, readPolicySnapshot } from "./entitlements";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return `${base || "offer"}-${randomBytes(3).toString("hex")}`;
}

function assertPrice(priceCents: number, minPriceCents: number | null) {
  if (!Number.isInteger(priceCents) || priceCents < 100) {
    throw new AppError(400, "Resale price must be at least $1.00", "INVALID_PRICE");
  }
  if (priceCents > RESELLER_PRICE_MAX_CENTS) {
    throw new AppError(400, "Resale price exceeds the allowed maximum", "INVALID_PRICE");
  }
  if (minPriceCents != null && priceCents < minPriceCents) {
    throw new AppError(400, "Resale price is below the commercial minimum", "PRICE_BELOW_MINIMUM");
  }
}

function cleanCurrency(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "USD";
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AppError(400, "Currency must be a 3-letter code", "INVALID_CURRENCY");
  }
  return currency;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function assertBrand(input: {
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandAccent?: string | null;
  allowBranding: boolean;
}) {
  const brandName = cleanText(input.brandName, 80);
  const brandLogoUrl = cleanText(input.brandLogoUrl, 500);
  const brandAccent = cleanText(input.brandAccent, 16);
  const hasBrand = Boolean(brandName || brandLogoUrl || brandAccent);
  if (hasBrand && !input.allowBranding) {
    throw new AppError(400, "This entitlement does not allow custom branding", "BRANDING_NOT_ALLOWED");
  }
  if (brandLogoUrl && !/^https:\/\/.+/i.test(brandLogoUrl)) {
    throw new AppError(400, "Brand logo must be an https URL", "INVALID_BRAND");
  }
  if (brandAccent && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandAccent)) {
    throw new AppError(400, "Brand accent must be a hex color", "INVALID_BRAND");
  }
  return { brandName, brandLogoUrl, brandAccent };
}

async function loadOwnedEntitlement(userId: string, entitlementId: string) {
  const entitlement = await prisma.resellerEntitlement.findFirst({
    where: { id: entitlementId, userId },
  });
  if (!entitlement || entitlement.status !== "ACTIVE") {
    throw new AppError(403, "You are not authorized to resell this catalog item", "RESELLER_ENTITLEMENT_REQUIRED");
  }
  return entitlement;
}

async function resolveOfferProducts(entitlementCovered: string[], requested: string[] | undefined) {
  const covered = new Set(entitlementCovered);
  const ids = requested?.length ? requested : entitlementCovered;
  const unique = [...new Set(ids)];
  if (!unique.length) {
    throw new AppError(400, "Offer must include at least one entitled product", "EMPTY_OFFER");
  }
  if (unique.some((id) => !covered.has(id))) {
    throw new AppError(403, "Offer includes a product you are not entitled to resell", "RESELLER_SCOPE");
  }
  const products = await prisma.product.findMany({
    where: { id: { in: unique }, status: "PUBLISHED" },
    select: { id: true, name: true, slug: true, shortDescription: true },
  });
  if (products.length !== unique.length) {
    throw new AppError(400, "One or more products are not available", "INVALID_PRODUCT");
  }
  return products;
}

export type OfferInput = {
  entitlementId: string;
  title: string;
  description?: string | null;
  priceCents: number;
  productIds?: string[];
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandAccent?: string | null;
  salesCopy?: string | null;
  ctaText?: string | null;
  currency?: string | null;
  status?: ResellerOfferStatus;
};

export async function createResellerOffer(userId: string, input: OfferInput) {
  const title = cleanText(input.title, 80);
  if (!title || title.length < 2) {
    throw new AppError(400, "Offer title is required", "INVALID_TITLE");
  }
  const entitlement = await loadOwnedEntitlement(userId, input.entitlementId);
  const snapshot = readPolicySnapshot(entitlement.policySnapshot);
  assertPrice(input.priceCents, snapshot?.minPriceCents ?? null);
  const brand = assertBrand({ ...input, allowBranding: snapshot?.allowBranding !== false });
  const products = await resolveOfferProducts(readCoveredProductIds(entitlement.coveredProductIds), input.productIds);
  const status = input.status === "PUBLISHED" || input.status === "DRAFT" ? input.status : "DRAFT";

  return prisma.resellerOffer.create({
    data: {
      resellerUserId: userId,
      entitlementId: entitlement.id,
      slug: slugify(title),
      title,
      description: cleanText(input.description, 2000),
      priceCents: input.priceCents,
      currency: cleanCurrency(input.currency),
      status,
      salesCopy: cleanText(input.salesCopy, 4000),
      ctaText: cleanText(input.ctaText, 40),
      ...brand,
      products: { create: products.map((product) => ({ productId: product.id })) },
    },
    include: { products: { include: { product: { select: { id: true, name: true, slug: true } } } } },
  });
}

export async function updateResellerOffer(
  userId: string,
  offerId: string,
  input: Partial<OfferInput> & { status?: ResellerOfferStatus }
) {
  const offer = await prisma.resellerOffer.findFirst({
    where: { id: offerId, resellerUserId: userId },
    include: { entitlement: true },
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  if (offer.entitlement.status !== "ACTIVE" && (input.status === "ACTIVE" || input.status === "PUBLISHED")) {
    throw new AppError(403, "Reseller rights for this offer are no longer active", "RESELLER_ENTITLEMENT_REQUIRED");
  }

  const entitlementId = input.entitlementId || offer.entitlementId;
  const entitlement = await loadOwnedEntitlement(userId, entitlementId);
  const snapshot = readPolicySnapshot(entitlement.policySnapshot);
  const priceCents = input.priceCents ?? offer.priceCents;
  assertPrice(priceCents, snapshot?.minPriceCents ?? null);
  const brand = assertBrand({
    brandName: input.brandName === undefined ? offer.brandName : input.brandName,
    brandLogoUrl: input.brandLogoUrl === undefined ? offer.brandLogoUrl : input.brandLogoUrl,
    brandAccent: input.brandAccent === undefined ? offer.brandAccent : input.brandAccent,
    allowBranding: snapshot?.allowBranding !== false,
  });

  const products = input.productIds
    ? await resolveOfferProducts(readCoveredProductIds(entitlement.coveredProductIds), input.productIds)
    : null;

  const status = input.status && ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].includes(input.status)
    ? input.status
    : undefined;

  if (products) {
    await prisma.resellerOfferProduct.deleteMany({ where: { offerId: offer.id } });
  }

  return prisma.resellerOffer.update({
    where: { id: offer.id },
    data: {
      entitlementId: entitlement.id,
      title: input.title ? cleanText(input.title, 80) || offer.title : offer.title,
      description: input.description === undefined ? undefined : cleanText(input.description, 2000),
      priceCents,
      currency: input.currency === undefined ? undefined : cleanCurrency(input.currency),
      status,
      salesCopy: input.salesCopy === undefined ? undefined : cleanText(input.salesCopy, 4000),
      ctaText: input.ctaText === undefined ? undefined : cleanText(input.ctaText, 40),
      ...brand,
      ...(products
        ? { products: { create: products.map((product) => ({ productId: product.id })) } }
        : {}),
    },
    include: { products: { include: { product: { select: { id: true, name: true, slug: true } } } } },
  });
}

export async function setOwnedOfferStatus(
  userId: string,
  offerId: string,
  status: "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED"
) {
  const offer = await prisma.resellerOffer.findFirst({
    where: { id: offerId, resellerUserId: userId },
    include: { entitlement: true, products: true },
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  if (status === "PUBLISHED") {
    if (offer.entitlement.status !== "ACTIVE" || offer.entitlement.userId !== userId) {
      throw new AppError(403, "Reseller rights for this offer are no longer active", "RESELLER_ENTITLEMENT_REQUIRED");
    }
    const snapshot = readPolicySnapshot(offer.entitlement.policySnapshot);
    assertPrice(offer.priceCents, snapshot?.minPriceCents ?? null);
    if (!offer.title.trim() || offer.title.trim().length < 2) {
      throw new AppError(400, "Offer title is required before publishing", "INVALID_OFFER");
    }
    if (!offer.products.length) {
      throw new AppError(400, "Offer must include at least one entitled product", "EMPTY_OFFER");
    }
    const covered = new Set(readCoveredProductIds(offer.entitlement.coveredProductIds));
    if (offer.products.some((row) => !covered.has(row.productId))) {
      throw new AppError(403, "Offer includes a product you are not entitled to resell", "RESELLER_SCOPE");
    }
  }
  return prisma.resellerOffer.update({
    where: { id: offer.id },
    data: { status },
    include: { products: { include: { product: { select: { id: true, name: true, slug: true } } } } },
  });
}

export async function deleteOwnedOffer(userId: string, offerId: string) {
  const offer = await prisma.resellerOffer.findFirst({
    where: { id: offerId, resellerUserId: userId },
    include: { _count: { select: { sales: true } } },
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  if (offer._count.sales > 0) {
    throw new AppError(
      409,
      "This offer has sales history and cannot be deleted",
      "OFFER_HAS_SALES"
    );
  }

  await prisma.$transaction([
    prisma.resellerAgencyProfile.updateMany({
      where: { offerId: offer.id, userId },
      data: { offerId: null },
    }),
    prisma.resellerOffer.delete({ where: { id: offer.id } }),
  ]);

  return { id: offer.id };
}

export function serializeOffer(
  offer: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    priceCents: number;
    currency: string;
    status: string;
    brandName: string | null;
    brandLogoUrl: string | null;
    brandAccent: string | null;
    salesCopy?: string | null;
    ctaText?: string | null;
    entitlementId: string;
    createdAt: Date;
    updatedAt: Date;
    products: Array<{ product: { id: string; name: string; slug: string } }>;
  },
  extra?: Record<string, unknown>
) {
  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    description: offer.description,
    priceCents: offer.priceCents,
    currency: offer.currency,
    status: offer.status,
    brandName: offer.brandName,
    brandLogoUrl: offer.brandLogoUrl,
    brandAccent: offer.brandAccent,
    salesCopy: offer.salesCopy ?? null,
    ctaText: offer.ctaText ?? null,
    entitlementId: offer.entitlementId,
    publicPath: `/r/${offer.slug}`,
    products: offer.products.map((row) => row.product),
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    ...extra,
  };
}
