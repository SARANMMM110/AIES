import { Router } from "express";
import { z } from "zod";
import { prisma } from "@aes/database";
import {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  type AuthRequest,
} from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { createUserWithSession } from "../auth/create-user-session";
import {
  provisionPurchaseAccess,
  purchaseIncludeDetail,
  serializePurchase,
} from "./purchase-service";
import { startCheckout } from "../payments/checkout.service";
import { writeAuditLog } from "../audit/audit";
import { rateLimit } from "../../middleware/rateLimit";
import { env } from "../../config/env";

/**
 * Unified purchasing API (Phase 5 + guest checkout + Phase 8 payments).
 * Creates checkout via payment provider; simulated mode completes immediately.
 * Guests may create an account in the same request.
 */
export const purchasesRouter = Router();

const itemSchema = z.object({
  type: z.enum(["product", "bundle"]),
  slug: z.string().min(1).max(120),
});

const accountSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  account: accountSchema.optional(),
});

purchasesRouter.post(
  "/",
  optionalAuthenticate,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_PURCHASE_MAX,
    name: "purchases",
  }),
  validate(createSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      let userId = req.user?.id;
      let userEmail = req.user?.email;
      let session: Awaited<ReturnType<typeof createUserWithSession>> | undefined;

      if (!userId) {
        if (!body.account) {
          throw new AppError(
            400,
            "Create an account to complete your purchase",
            "ACCOUNT_REQUIRED"
          );
        }
        session = await createUserWithSession(body.account);
        userId = session.userId;
        userEmail = session.user.email;
      }

      const result = await startCheckout({
        userId,
        userEmail: userEmail!,
        items: body.items,
        actorEmail: userEmail,
      });

      res.status(201).json(
        ok({
          mode: result.mode,
          purchase: result.purchase,
          lines: result.lines,
          grantedProducts: result.grantedProducts,
          grantedBundles: result.grantedBundles,
          paymentStatus: result.paymentStatus,
          paymentNote: result.paymentNote,
          checkoutUrl: result.checkoutUrl,
          redirectTo:
            result.mode === "checkout"
              ? result.redirectTo
              : result.redirectTo,
          workspaceRedirect: result.mode === "completed" ? result.redirectTo : result.redirectTo,
          ...(session
            ? {
                user: session.user,
                tokens: session.tokens,
                accountCreated: true,
              }
            : { accountCreated: false }),
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

/** Admin list — registered before :purchaseId */
purchasesRouter.get("/", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const purchaseType =
      typeof req.query.purchaseType === "string" ? req.query.purchaseType : undefined;
    const productSlug =
      typeof req.query.product === "string" ? req.query.product : undefined;
    const bundleSlug =
      typeof req.query.bundle === "string" ? req.query.bundle : undefined;
    const userQ = typeof req.query.user === "string" ? req.query.user.trim() : undefined;
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const purchases = await prisma.purchase.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(purchaseType ? { purchaseType: purchaseType as never } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
                ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
              },
            }
          : {}),
        ...(userQ
          ? {
              user: {
                OR: [
                  { email: { contains: userQ, mode: "insensitive" } },
                  { firstName: { contains: userQ, mode: "insensitive" } },
                  { lastName: { contains: userQ, mode: "insensitive" } },
                ],
              },
            }
          : {}),
        ...(productSlug || bundleSlug
          ? {
              items: {
                some: {
                  ...(productSlug ? { product: { slug: productSlug } } : {}),
                  ...(bundleSlug ? { bundle: { slug: bundleSlug } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        ...purchaseIncludeDetail,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    res.json(ok({ purchases: purchases.map(serializePurchase) }));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/analytics/summary", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            bundle: { select: { id: true, name: true, slug: true } },
          },
        },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const completed = purchases.filter((p) => p.status === "COMPLETED");
    const byStatus = {
      COMPLETED: purchases.filter((p) => p.status === "COMPLETED").length,
      PENDING: purchases.filter((p) => p.status === "PENDING").length,
      CANCELLED: purchases.filter((p) => p.status === "CANCELLED").length,
      REFUNDED: purchases.filter((p) => p.status === "REFUNDED").length,
    };
    const byType = {
      PRODUCT: purchases.filter((p) => p.purchaseType === "PRODUCT").length,
      MULTI_PRODUCT: purchases.filter((p) => p.purchaseType === "MULTI_PRODUCT").length,
      BUNDLE: purchases.filter((p) => p.purchaseType === "BUNDLE").length,
    };

    const revenueTotal = completed.reduce((s, p) => s + p.totalAmount, 0);
    const productRevenue = new Map<string, { name: string; slug: string; amount: number; count: number }>();
    const bundleRevenue = new Map<string, { name: string; slug: string; amount: number; count: number }>();

    for (const p of completed) {
      for (const item of p.items) {
        const line = item.price * item.quantity;
        if (item.itemType === "PRODUCT" && item.product) {
          const cur = productRevenue.get(item.product.slug) ?? {
            name: item.product.name,
            slug: item.product.slug,
            amount: 0,
            count: 0,
          };
          cur.amount += line;
          cur.count += 1;
          productRevenue.set(item.product.slug, cur);
        }
        if (item.itemType === "BUNDLE" && item.bundle) {
          const cur = bundleRevenue.get(item.bundle.slug) ?? {
            name: item.bundle.name,
            slug: item.bundle.slug,
            amount: 0,
            count: 0,
          };
          cur.amount += line;
          cur.count += 1;
          bundleRevenue.set(item.bundle.slug, cur);
        }
      }
    }

    const topProducts = [...productRevenue.values()].sort((a, b) => b.count - a.count).slice(0, 10);
    const topBundles = [...bundleRevenue.values()].sort((a, b) => b.count - a.count).slice(0, 10);

    res.json(
      ok({
        totals: {
          purchases: purchases.length,
          ...byStatus,
          ...byType,
          revenueCents: revenueTotal,
        },
        byStatus,
        byType,
        revenueByProduct: [...productRevenue.values()].sort((a, b) => b.amount - a.amount),
        revenueByBundle: [...bundleRevenue.values()].sort((a, b) => b.amount - a.amount),
        topProducts,
        topBundles,
        recent: purchases.slice(0, 15).map(serializePurchase),
      })
    );
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/me", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const [purchases, productAccess, bundleAccess] = await Promise.all([
      prisma.purchase.findMany({
        where: { userId },
        include: purchaseIncludeDetail,
        orderBy: { createdAt: "desc" },
      }),
      prisma.productAccess.findMany({
        where: {
          userId,
          status: "ACTIVE",
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
        include: { product: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bundleAccess.findMany({
        where: {
          userId,
          status: "ACTIVE",
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
        include: { bundle: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const coveredProductIds = new Set<string>();
    const coveredBundleIds = new Set<string>();
    for (const purchase of purchases) {
      for (const item of purchase.items) {
        if (item.productId) coveredProductIds.add(item.productId);
        if (item.bundleId) coveredBundleIds.add(item.bundleId);
      }
    }

    const rows: ReturnType<typeof serializePurchase>[] = purchases.map(serializePurchase);

    // Admin grants / provisioned access often have no Purchase row — still show them
    // (including the user's first unlocked agency) in purchase history.
    for (const access of bundleAccess) {
      if (coveredBundleIds.has(access.bundleId)) continue;
      coveredBundleIds.add(access.bundleId);
      rows.push({
        id: `access-bundle-${access.id}`,
        code: `ACC-${access.id.slice(-8).toUpperCase()}`,
        status: "COMPLETED",
        purchaseType: "BUNDLE",
        totalAmount: 0,
        subtotalAmount: 0,
        discountAmount: 0,
        currency: "USD",
        paymentStatus: access.source === "ADMIN_GRANT" ? "ADMIN_GRANT" : "GRANTED",
        paymentNote: "Access granted by AES team",
        paymentProvider: null,
        providerSessionId: null,
        providerPaymentId: null,
        paidAt: access.createdAt,
        accessProvisionedAt: access.createdAt,
        cancelledAt: null,
        refundedAt: null,
        createdAt: access.createdAt,
        updatedAt: access.updatedAt,
        user: undefined,
        items: [
          {
            id: access.id,
            itemType: "BUNDLE",
            quantity: 1,
            price: 0,
            product: null,
            bundle: access.bundle
              ? { id: access.bundle.id, name: access.bundle.name, slug: access.bundle.slug }
              : { id: access.bundleId, name: "Bundle", slug: null },
          },
        ],
      });
    }

    for (const access of productAccess) {
      // Bundle-materialized rows are represented by the bundle grant above when present.
      if (access.bundleId) continue;
      if (coveredProductIds.has(access.productId)) continue;
      coveredProductIds.add(access.productId);
      rows.push({
        id: `access-product-${access.id}`,
        code: `ACC-${access.id.slice(-8).toUpperCase()}`,
        status: "COMPLETED",
        purchaseType: "PRODUCT",
        totalAmount: 0,
        subtotalAmount: 0,
        discountAmount: 0,
        currency: "USD",
        paymentStatus: access.source === "ADMIN_GRANT" ? "ADMIN_GRANT" : "GRANTED",
        paymentNote: "Access granted by AES team",
        paymentProvider: null,
        providerSessionId: null,
        providerPaymentId: null,
        paidAt: access.createdAt,
        accessProvisionedAt: access.createdAt,
        cancelledAt: null,
        refundedAt: null,
        createdAt: access.createdAt,
        updatedAt: access.updatedAt,
        user: undefined,
        items: [
          {
            id: access.id,
            itemType: "PRODUCT",
            quantity: 1,
            price: 0,
            product: access.product
              ? { id: access.product.id, name: access.product.name, slug: access.product.slug }
              : { id: access.productId, name: "Agency", slug: null },
            bundle: null,
          },
        ],
      });
    }

    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(ok({ purchases: rows }));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/:purchaseId", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.purchaseId },
      include: {
        ...purchaseIncludeDetail,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    assertFound(purchase, "Purchase not found");
    if (purchase.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }

    const productAccess = await prisma.productAccess.findMany({
      where: { userId: purchase.userId, status: "ACTIVE" },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });

    res.json(
      ok({
        purchase: serializePurchase(purchase),
        accessGranted: productAccess.map((a) => ({
          productId: a.productId,
          name: a.product.name,
          slug: a.product.slug,
          source: a.source,
          bundleId: a.bundleId,
        })),
      })
    );
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post(
  "/:purchaseId/provision",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await provisionPurchaseAccess(req.params.purchaseId);
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "purchase.admin_provision",
        entityType: "Purchase",
        entityId: req.params.purchaseId,
      });
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);
