import { Router } from "express";
import { prisma, type ResellerScope } from "@aes/database";
import type { AuthRequest } from "../../middleware/auth";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { writeAuditLog } from "../audit/audit";
import { COMPLETE_SUITE_SLUG } from "./constants";
import { refundResellerSale } from "./checkout";

export const adminResellerRouter = Router();

adminResellerRouter.get("/policies", async (_req, res, next) => {
  try {
    const [products, bundles, policies, entitlements, offers, sales] = await Promise.all([
      prisma.product.findMany({
        where: { slug: { in: [...APPROVED_PRODUCT_SLUGS] } },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.bundle.findMany({
        where: { status: { in: ["ACTIVE", "DRAFT"] } },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.resellerPolicy.findMany(),
      prisma.resellerEntitlement.count({ where: { status: "ACTIVE" } }),
      prisma.resellerOffer.count(),
      prisma.resellerSale.count({ where: { status: "COMPLETED" } }),
    ]);

    const productPolicy = new Map(
      policies.filter((policy) => policy.productId).map((policy) => [policy.productId as string, policy])
    );
    const bundlePolicy = new Map(
      policies.filter((policy) => policy.bundleId).map((policy) => [policy.bundleId as string, policy])
    );
    const suite = policies.find((policy) => policy.scope === "COMPLETE_SUITE") ?? null;

    res.json(
      ok({
        stats: { entitlements, offers, sales },
        suite: {
          slug: COMPLETE_SUITE_SLUG,
          enabled: suite?.enabled ?? false,
          allowBranding: suite?.allowBranding ?? true,
          minPriceCents: suite?.minPriceCents ?? null,
          note: suite?.note ?? null,
        },
        products: products.map((product) => ({
          ...product,
          enabled: productPolicy.get(product.id)?.enabled ?? false,
          allowBranding: productPolicy.get(product.id)?.allowBranding ?? true,
          minPriceCents: productPolicy.get(product.id)?.minPriceCents ?? null,
        })),
        bundles: bundles
          .filter((bundle) => bundle.slug !== COMPLETE_SUITE_SLUG)
          .map((bundle) => ({
            ...bundle,
            enabled: bundlePolicy.get(bundle.id)?.enabled ?? false,
            allowBranding: bundlePolicy.get(bundle.id)?.allowBranding ?? true,
            minPriceCents: bundlePolicy.get(bundle.id)?.minPriceCents ?? null,
          })),
      })
    );
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.put("/policies", async (req: AuthRequest, res, next) => {
  try {
    const body = req.body ?? {};
    const scope = String(body.scope || "") as ResellerScope;
    if (scope !== "PRODUCT" && scope !== "BUNDLE" && scope !== "COMPLETE_SUITE") {
      throw new AppError(400, "Invalid reseller policy scope", "INVALID_SCOPE");
    }
    const enabled = Boolean(body.enabled);
    const allowBranding = body.allowBranding !== false;
    const minPriceCents =
      body.minPriceCents === null || body.minPriceCents === undefined || body.minPriceCents === ""
        ? null
        : Number(body.minPriceCents);
    if (minPriceCents != null && (!Number.isInteger(minPriceCents) || minPriceCents < 0)) {
      throw new AppError(400, "Minimum price is invalid", "INVALID_PRICE");
    }

    let productId: string | null = null;
    let bundleId: string | null = null;

    if (scope === "PRODUCT") {
      const product = await prisma.product.findFirst({
        where: { id: String(body.productId || ""), slug: { in: [...APPROVED_PRODUCT_SLUGS] } },
      });
      if (!product) throw new AppError(404, "Product not found", "NOT_FOUND");
      productId = product.id;
    } else if (scope === "BUNDLE") {
      const bundle = await prisma.bundle.findFirst({
        where: { id: String(body.bundleId || ""), slug: { not: COMPLETE_SUITE_SLUG } },
      });
      if (!bundle) throw new AppError(404, "Bundle not found", "NOT_FOUND");
      bundleId = bundle.id;
    }

    const existing =
      scope === "COMPLETE_SUITE"
        ? await prisma.resellerPolicy.findFirst({ where: { scope: "COMPLETE_SUITE" } })
        : scope === "PRODUCT"
          ? await prisma.resellerPolicy.findUnique({ where: { productId: productId! } })
          : await prisma.resellerPolicy.findUnique({ where: { bundleId: bundleId! } });

    const data = {
      scope,
      productId,
      bundleId,
      enabled,
      allowBranding,
      minPriceCents,
      note: body.note ? String(body.note).slice(0, 300) : null,
    };

    const policy = existing
      ? await prisma.resellerPolicy.update({ where: { id: existing.id }, data })
      : await prisma.resellerPolicy.create({ data });

    // Purchasers turn resell and white-label on in their own account.
    const sync = null;

    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "reseller.policy.updated",
      entityType: "ResellerPolicy",
      entityId: policy.id,
      metadata: { scope, enabled, productId, bundleId },
    });

    res.json(ok({ policy, sync }));
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.post("/sync", async (_req: AuthRequest, res, next) => {
  try {
    throw new AppError(
      403,
      "Resell and white-label are chosen in the purchaser's account, not from admin",
      "ACCOUNT_CONTROL"
    );
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.get("/sales", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const sales = await prisma.resellerSale.findMany({
      where: {
        ...(status ? { status: status as "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { paymentReference: { contains: q, mode: "insensitive" } },
                { customer: { email: { contains: q, mode: "insensitive" } } },
                { reseller: { email: { contains: q, mode: "insensitive" } } },
                { offer: { title: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        reseller: { select: { email: true, firstName: true, lastName: true } },
        customer: { select: { email: true, firstName: true, lastName: true, userId: true } },
        offer: { select: { title: true, slug: true } },
        product: { select: { name: true, slug: true } },
        bundle: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(
      ok(
        sales.map((sale) => ({
          id: sale.id,
          code: sale.code,
          status: sale.status === "COMPLETED" ? "PAID" : sale.status,
          amountCents: sale.amountCents,
          currency: sale.currency,
          paymentProvider: sale.paymentProvider,
          paymentReference: sale.paymentReference,
          createdAt: sale.createdAt,
          paidAt: sale.paidAt,
          refundedAt: sale.refundedAt,
          accessReady: Boolean(sale.accessProvisionedAt),
          reseller: sale.reseller,
          customer: sale.customer,
          offer: sale.offer,
          product: sale.product,
          bundle: sale.bundle,
          chain: "AES purchase → entitlement → offer → sale → customer → use access",
        }))
      )
    );
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.post("/sales/:id/refund", async (req: AuthRequest, res, next) => {
  try {
    const result = await refundResellerSale(req.params.id, req.user?.id, req.body?.refundReference ? String(req.body.refundReference) : null);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.get("/directory", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const productId = String(req.query.productId || "").trim();
    const [entitlements, offers, customers, branding, sales] = await Promise.all([
      prisma.resellerEntitlement.findMany({
        where: {
          ...(status === "ACTIVE" || status === "REVOKED" ? { status } : {}),
          ...(productId ? { coveredProductIds: { array_contains: productId } } : {}),
          ...(q ? { user: { email: { contains: q, mode: "insensitive" } } } : {}),
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          product: { select: { id: true, name: true, slug: true } },
          bundle: { select: { id: true, name: true, slug: true } },
          purchase: { select: { id: true, status: true, paymentStatus: true, createdAt: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.resellerOffer.findMany({
        where: q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reseller: { email: { contains: q, mode: "insensitive" } } }] } : {},
        include: { reseller: { select: { email: true } }, products: { include: { product: { select: { name: true } } } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.resellerCustomer.findMany({
        where: q
          ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { reseller: { email: { contains: q, mode: "insensitive" } } }] }
          : {},
        include: { reseller: { select: { email: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.resellerBranding.findMany({
        where: q ? { user: { email: { contains: q, mode: "insensitive" } } } : {},
        include: { user: { select: { email: true } } },
        take: 100,
      }),
      prisma.resellerSale.count(),
    ]);
    res.json(
      ok({
        entitlements: entitlements.map((row) => ({
          id: row.id,
          status: row.status,
          scope: row.scope,
          canResell: row.status === "ACTIVE",
          canWhiteLabel: row.policySnapshot && typeof row.policySnapshot === "object" && (row.policySnapshot as { allowBranding?: boolean }).allowBranding === true,
          reseller: row.user,
          product: row.product,
          bundle: row.bundle,
          purchase: row.purchase,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        offers: offers.map((offer) => ({
          id: offer.id,
          title: offer.title,
          slug: offer.slug,
          status: offer.status,
          priceCents: offer.priceCents,
          currency: offer.currency,
          reseller: offer.reseller.email,
          products: offer.products.map((row) => row.product.name),
        })),
        customers: customers.map((customer) => ({
          id: customer.id,
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          status: customer.status,
          reseller: customer.reseller.email,
        })),
        branding: branding.map((row) => ({
          id: row.id,
          reseller: row.user.email,
          brandName: row.brandName,
          supportEmail: row.supportEmail,
          website: row.website,
          updatedAt: row.updatedAt,
        })),
        sales,
      })
    );
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.get("/sales/:id/trace", async (req, res, next) => {
  try {
    const sale = await prisma.resellerSale.findUnique({
      where: { id: req.params.id },
      include: {
        reseller: { select: { id: true, email: true } },
        customer: { select: { id: true, email: true, userId: true } },
        offer: { select: { id: true, title: true, slug: true, entitlementId: true } },
        product: { select: { id: true, name: true, slug: true } },
        access: { select: { productAccessId: true, product: { select: { name: true } } } },
      },
    });
    if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");
    const entitlement = await prisma.resellerEntitlement.findUnique({
      where: { id: sale.offer.entitlementId },
      select: { id: true, status: true, purchaseId: true, scope: true },
    });
    res.json(
      ok({
        purchaseId: entitlement?.purchaseId ?? null,
        entitlement,
        reseller: sale.reseller,
        offer: sale.offer,
        sale: { id: sale.id, code: sale.code, status: sale.status, amountCents: sale.amountCents },
        customer: sale.customer,
        accountUserId: sale.customer.userId,
        access: sale.access,
      })
    );
  } catch (err) {
    next(err);
  }
});

adminResellerRouter.post("/entitlements/:id/revoke", async (req: AuthRequest, res, next) => {
  try {
    const entitlement = await prisma.resellerEntitlement.findUnique({ where: { id: req.params.id } });
    if (!entitlement) throw new AppError(404, "Entitlement not found", "NOT_FOUND");
    const updated = await prisma.resellerEntitlement.update({
      where: { id: entitlement.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await prisma.resellerOffer.updateMany({
      where: { entitlementId: entitlement.id, status: { in: ["ACTIVE", "PUBLISHED"] } },
      data: { status: "UNPUBLISHED" },
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "reseller.entitlement.revoked",
      entityType: "ResellerEntitlement",
      entityId: entitlement.id,
    });
    res.json(ok(updated));
  } catch (err) {
    next(err);
  }
});
