import { Router } from "express";
import { z } from "zod";
import { prisma, AccessSource, AccessStatus } from "@aes/database";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { grantBundleAccess, grantDirectProductAccess } from "./grant-access";
import { writeAuditLog } from "../audit/audit";

export const accessRouter = Router();

accessRouter.use(authenticate);

/** Current user's effective product access. */
accessRouter.get("/me", async (req: AuthRequest, res, next) => {
  try {
    const access = await prisma.productAccess.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: { product: true, bundle: true },
      orderBy: { createdAt: "desc" },
    });
    const bundles = await prisma.bundleAccess.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: { bundle: { include: { items: true } } },
    });
    res.json(ok({ productAccess: access, bundleAccess: bundles }));
  } catch (err) {
    next(err);
  }
});

/** Check whether current user can access a product. */
accessRouter.get("/me/products/:productId/check", async (req: AuthRequest, res, next) => {
  try {
    const hasAccess = await userHasProductAccess(
      req.user!.id,
      req.params.productId,
      req.user!.role
    );
    res.json(ok({ productId: req.params.productId, hasAccess }));
  } catch (err) {
    next(err);
  }
});

const grantProductSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().min(1),
  source: z.nativeEnum(AccessSource).default("ADMIN_GRANT"),
  endsAt: z.string().datetime().optional(),
});

const grantBundleSchema = z.object({
  userId: z.string().min(1),
  bundleId: z.string().min(1),
  source: z.nativeEnum(AccessSource).default("ADMIN_GRANT"),
  endsAt: z.string().datetime().optional(),
});

/** Admin: grant direct product access (individual agency, not all products). */
accessRouter.post(
  "/products/grant",
  requireAdmin,
  validate(grantProductSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof grantProductSchema>;
      assertFound(await prisma.user.findUnique({ where: { id: body.userId } }), "User not found");
      assertFound(
        await prisma.product.findUnique({ where: { id: body.productId } }),
        "Product not found"
      );

      const result = await grantDirectProductAccess(prisma, {
        userId: body.userId,
        productId: body.productId,
        source: body.source,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      });

      await writeAuditLog({
        actorId: (req as AuthRequest).user?.id,
        actorEmail: (req as AuthRequest).user?.email,
        action: "access.product_granted",
        entityType: "ProductAccess",
        entityId: result.access.id,
        metadata: { userId: body.userId, productId: body.productId, source: body.source },
      });

      res.status(result.created ? 201 : 200).json(ok({ access: result.access }));
    } catch (err) {
      next(err);
    }
  }
);

/** Admin: grant bundle access and materialize per-product access. */
accessRouter.post(
  "/bundles/grant",
  requireAdmin,
  validate(grantBundleSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof grantBundleSchema>;
      assertFound(await prisma.user.findUnique({ where: { id: body.userId } }), "User not found");
      const bundle = await prisma.bundle.findUnique({
        where: { id: body.bundleId },
        include: { items: true },
      });
      assertFound(bundle, "Bundle not found");

      const result = await prisma.$transaction(async (tx) =>
        grantBundleAccess(tx, {
          userId: body.userId,
          bundleId: body.bundleId,
          source: body.source,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        })
      );

      await writeAuditLog({
        actorId: (req as AuthRequest).user?.id,
        actorEmail: (req as AuthRequest).user?.email,
        action: "access.bundle_granted",
        entityType: "BundleAccess",
        entityId: result.bundleAccess.id,
        metadata: { userId: body.userId, bundleId: body.bundleId, source: body.source },
      });

      res.status(201).json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);

accessRouter.post("/products/:accessId/revoke", requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.productAccess.findUnique({ where: { id: req.params.accessId } });
    assertFound(existing, "Product access not found");
    const access = await prisma.productAccess.update({
      where: { id: existing.id },
      data: { status: "REVOKED" satisfies AccessStatus },
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "access.product_revoked",
      entityType: "ProductAccess",
      entityId: access.id,
      metadata: { userId: access.userId, productId: access.productId },
    });
    res.json(ok({ access }));
  } catch (err) {
    next(err);
  }
});

accessRouter.post("/bundles/:accessId/revoke", requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const access = await prisma.bundleAccess.update({
      where: { id: req.params.accessId },
      data: { status: "REVOKED" satisfies AccessStatus },
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "access.bundle_revoked",
      entityType: "BundleAccess",
      entityId: access.id,
      metadata: { userId: access.userId, bundleId: access.bundleId },
    });
    // Also revoke product access rows that were materialised from this bundle
    // (does not delete purchase history).
    await prisma.productAccess.updateMany({
      where: {
        userId: access.userId,
        bundleId: access.bundleId,
        status: "ACTIVE",
      },
      data: { status: "REVOKED" },
    });
    res.json(ok({ access }));
  } catch (err) {
    next(err);
  }
});

accessRouter.get("/admin/users/:userId", requireAdmin, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    assertFound(await prisma.user.findUnique({ where: { id: userId } }), "User not found");
    const [productAccess, bundleAccess, purchases] = await Promise.all([
      prisma.productAccess.findMany({
        where: { userId },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          bundle: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.bundleAccess.findMany({
        where: { userId },
        include: { bundle: { select: { id: true, name: true, slug: true, status: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.purchase.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: { select: { name: true, slug: true } },
              bundle: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    res.json(ok({ productAccess, bundleAccess, purchases }));
  } catch (err) {
    next(err);
  }
});

export async function userHasProductAccess(
  userId: string,
  productId: string,
  role?: string
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const direct = await prisma.productAccess.findFirst({
    where: {
      userId,
      productId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
  });
  return Boolean(direct);
}

/** Middleware factory: require product access (or admin). */
export function requireProductAccess(paramName = "productId") {
  return async (req: AuthRequest, _res: unknown, next: (err?: unknown) => void) => {
    try {
      if (!req.user) throw new AppError(401, "Authentication required", "UNAUTHORIZED");
      const productId = req.params[paramName];
      const allowed = await userHasProductAccess(req.user.id, productId, req.user.role);
      if (!allowed) {
        throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
