import { prisma, type Prisma, type ResellerSaleStatus } from "@aes/database";
import { AppError } from "../../utils/errors";
import { loadResellerRights, readPolicySnapshot } from "./entitlements";

const PAID = ["PAID", "COMPLETED"] as const;

export async function requireReseller(userId: string) {
  const rights = await loadResellerRights(userId);
  if (!rights.length) {
    throw new AppError(403, "Reseller access is not available", "RESELLER_ENTITLEMENT_REQUIRED");
  }
  return rights;
}

export async function recordOfferEvent(offerId: string, resellerUserId: string, type: "VIEW" | "CHECKOUT_START") {
  await prisma.resellerOfferEvent.create({
    data: { offerId, resellerUserId, type },
  });
}

function paidWhere(userId: string): Prisma.ResellerSaleWhereInput {
  return { resellerUserId: userId, status: { in: [...PAID] } };
}

export async function resellerDashboard(userId: string) {
  const entitlements = await loadResellerRights(userId);
  const [offers, publishedOffers, customers, paid, pending, refunded, volume, recentSales, recentCustomers, offerSales] =
    await Promise.all([
      prisma.resellerOffer.count({ where: { resellerUserId: userId } }),
      prisma.resellerOffer.count({ where: { resellerUserId: userId, status: { in: ["PUBLISHED", "ACTIVE"] } } }),
      prisma.resellerCustomer.count({ where: { resellerUserId: userId } }),
      prisma.resellerSale.count({ where: paidWhere(userId) }),
      prisma.resellerSale.count({ where: { resellerUserId: userId, status: "PENDING" } }),
      prisma.resellerSale.count({ where: { resellerUserId: userId, status: "REFUNDED" } }),
      prisma.resellerSale.aggregate({ where: paidWhere(userId), _sum: { amountCents: true } }),
      prisma.resellerSale.findMany({
        where: { resellerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          code: true,
          status: true,
          amountCents: true,
          currency: true,
          createdAt: true,
          offer: { select: { title: true } },
          customer: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.resellerCustomer.findMany({
        where: { resellerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      }),
      prisma.resellerSale.groupBy({
        by: ["offerId"],
        where: paidWhere(userId),
        _count: { _all: true },
        _sum: { amountCents: true },
        orderBy: { _count: { offerId: "desc" } },
        take: 5,
      }),
    ]);
  const offerIds = offerSales.map((row) => row.offerId);
  const titles = offerIds.length
    ? await prisma.resellerOffer.findMany({
        where: { id: { in: offerIds }, resellerUserId: userId },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(titles.map((row) => [row.id, row.title]));
  const [savedAgencies, publishedAgencies, inquiries, views] = await Promise.all([
    prisma.resellerAgencyProfile.count({ where: { userId } }),
    prisma.resellerAgencyProfile.count({ where: { userId, published: true } }),
    prisma.resellerInquiry.count({ where: { resellerUserId: userId } }),
    prisma.resellerOfferEvent.count({ where: { resellerUserId: userId, type: "VIEW" } }),
  ]);
  return {
    entitlements: entitlements.map((item) => ({
      ...item,
      canResell: item.status === "ACTIVE",
      canWhiteLabel: item.policy?.allowBranding === true,
    })),
    stats: {
      offers,
      publishedOffers,
      customers,
      sales: paid + pending,
      paidSales: paid,
      pendingSales: pending,
      refundedSales: refunded,
      salesVolumeCents: volume._sum.amountCents ?? 0,
      savedAgencies,
      publishedAgencies,
      inquiries,
      views,
    },
    recentSales: recentSales.map((sale) => ({
      ...sale,
      status: sale.status === "COMPLETED" ? "PAID" : sale.status,
    })),
    recentCustomers,
    topOffers: offerSales.map((row) => ({
      offerId: row.offerId,
      title: titleById.get(row.offerId) || "Offer",
      paidSales: row._count._all,
      volumeCents: row._sum.amountCents ?? 0,
    })),
  };
}

export async function listOwnedOffers(userId: string) {
  const offers = await prisma.resellerOffer.findMany({
    where: { resellerUserId: userId },
    include: {
      products: { include: { product: { select: { id: true, name: true, slug: true } } } },
      entitlement: { select: { status: true, policySnapshot: true } },
      _count: { select: { sales: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const customerCounts = await prisma.resellerSale.groupBy({
    by: ["offerId"],
    where: { resellerUserId: userId },
    _count: { customerId: true },
  });
  const customersByOffer = new Map(customerCounts.map((row) => [row.offerId, row._count.customerId]));
  return offers.map((offer) => ({
    offer,
    customers: customersByOffer.get(offer.id) ?? 0,
    canSell: offer.entitlement.status === "ACTIVE",
    canWhiteLabel: readPolicySnapshot(offer.entitlement.policySnapshot)?.allowBranding === true,
  }));
}

const SALE_STATUSES = new Set(["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED", "COMPLETED"]);

export async function listOwnedSales(
  userId: string,
  query: { status?: string; offerId?: string; q?: string; from?: string; to?: string }
) {
  const status = query.status && SALE_STATUSES.has(query.status) ? query.status : "";
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const q = query.q?.trim();
  return prisma.resellerSale.findMany({
    where: {
      resellerUserId: userId,
      ...(status ? { status: (status === "PAID" ? { in: [...PAID] } : status) as ResellerSaleStatus | { in: ResellerSaleStatus[] } } : {}),
      ...(query.offerId ? { offerId: query.offerId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
              ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { customer: { email: { contains: q, mode: "insensitive" } } },
              { customer: { firstName: { contains: q, mode: "insensitive" } } },
              { customer: { lastName: { contains: q, mode: "insensitive" } } },
              { offer: { title: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      offer: { select: { id: true, title: true, slug: true } },
      customer: { select: { id: true, email: true, firstName: true, lastName: true, company: true } },
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function resellerAnalytics(userId: string) {
  const [views, starts, paid, pending, refunded, failed, cancelled, volume, byOffer, months] = await Promise.all([
    prisma.resellerOfferEvent.count({ where: { resellerUserId: userId, type: "VIEW" } }),
    prisma.resellerOfferEvent.count({ where: { resellerUserId: userId, type: "CHECKOUT_START" } }),
    prisma.resellerSale.count({ where: paidWhere(userId) }),
    prisma.resellerSale.count({ where: { resellerUserId: userId, status: "PENDING" } }),
    prisma.resellerSale.count({ where: { resellerUserId: userId, status: "REFUNDED" } }),
    prisma.resellerSale.count({ where: { resellerUserId: userId, status: "FAILED" } }),
    prisma.resellerSale.count({ where: { resellerUserId: userId, status: "CANCELLED" } }),
    prisma.resellerSale.aggregate({ where: paidWhere(userId), _sum: { amountCents: true } }),
    prisma.resellerOfferEvent.groupBy({
      by: ["offerId", "type"],
      where: { resellerUserId: userId },
      _count: { _all: true },
    }),
    prisma.resellerSale.findMany({
      where: paidWhere(userId),
      select: { amountCents: true, paidAt: true, createdAt: true },
    }),
  ]);
  const offers = await prisma.resellerOffer.findMany({
    where: { resellerUserId: userId },
    select: { id: true, title: true },
  });
  const paidByOffer = await prisma.resellerSale.groupBy({
    by: ["offerId"],
    where: paidWhere(userId),
    _count: { _all: true },
  });
  const paidMap = new Map(paidByOffer.map((row) => [row.offerId, row._count._all]));
  const eventMap = new Map<string, { views: number; checkouts: number }>();
  for (const row of byOffer) {
    const current = eventMap.get(row.offerId) ?? { views: 0, checkouts: 0 };
    if (row.type === "VIEW") current.views = row._count._all;
    if (row.type === "CHECKOUT_START") current.checkouts = row._count._all;
    eventMap.set(row.offerId, current);
  }
  const byMonth = new Map<string, { sales: number; volumeCents: number }>();
  for (const sale of months) {
    const when = sale.paidAt ?? sale.createdAt;
    const key = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = byMonth.get(key) ?? { sales: 0, volumeCents: 0 };
    current.sales += 1;
    current.volumeCents += sale.amountCents;
    byMonth.set(key, current);
  }
  return {
    note: "Reseller sales volume is not AES revenue.",
    totals: {
      views,
      checkoutStarts: starts,
      sales: paid + pending + refunded + failed + cancelled,
      paidSales: paid,
      pendingSales: pending,
      refundedSales: refunded,
      salesVolumeCents: volume._sum.amountCents ?? 0,
      conversion: views > 0 ? paid / views : null,
    },
    offers: offers.map((offer) => {
      const events = eventMap.get(offer.id) ?? { views: 0, checkouts: 0 };
      const paidSales = paidMap.get(offer.id) ?? 0;
      return {
        id: offer.id,
        title: offer.title,
        views: events.views,
        checkoutStarts: events.checkouts,
        paidSales,
        conversion: events.views > 0 ? paidSales / events.views : null,
      };
    }),
    months: [...byMonth.entries()].map(([month, value]) => ({ month, ...value })),
  };
}
