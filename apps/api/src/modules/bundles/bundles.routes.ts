import { Router } from "express";
import { z } from "zod";
import { prisma, BundleStatus } from "@aes/database";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { writeAuditLog } from "../audit/audit";
import { createTtlCache } from "../../lib/ttl-cache";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const bundleInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          priceCents: true,
          currency: true,
          icon: true,
          shortDescription: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
};

async function assertApprovedProducts(productIds: string[]) {
  if (!productIds.length) return;
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, slug: true, status: true },
  });
  if (products.length !== productIds.length) {
    throw new AppError(400, "One or more products not found", "INVALID_PRODUCTS");
  }
  for (const p of products) {
    if (!(APPROVED_PRODUCT_SLUGS as readonly string[]).includes(p.slug)) {
      throw new AppError(400, `Product ${p.slug} is not an approved agency`, "INVALID_PRODUCTS");
    }
  }
}

function serializeBundle(
  bundle: Awaited<ReturnType<typeof prisma.bundle.findFirstOrThrow>> & {
    items: Array<{
      id: string;
      sortOrder: number;
      productId: string;
      product: {
        id: string;
        name: string;
        slug: string;
        status: string;
        priceCents: number | null;
        currency: string;
        icon: string | null;
        shortDescription: string | null;
      };
    }>;
  }
) {
  const individualValue = bundle.items.reduce((sum, i) => sum + (i.product.priceCents ?? 0), 0);
  const bundlePrice = bundle.priceCents ?? 0;
  const savings =
    bundle.priceCents != null && individualValue > bundlePrice ? individualValue - bundlePrice : 0;
  return {
    ...bundle,
    productCount: bundle.items.length,
    individualValueCents: individualValue,
    savingsCents: savings,
    published: bundle.status === "ACTIVE",
  };
}

export const bundlesRouter = Router();

const adminBundlesListCache = createTtlCache<{ bundles: unknown[] }>(45_000);

export function bustBundlesListCache() {
  adminBundlesListCache.clear();
}

const createBundleSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(8000).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  priceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).default("USD"),
  status: z.nativeEnum(BundleStatus).optional(),
  icon: z.string().max(40).optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable().or(z.literal("")),
  displayOrder: z.number().int().optional(),
  productIds: z.array(z.string().min(1)).optional(),
});

const updateBundleSchema = createBundleSchema.partial().extend({
  productIds: z.array(z.string().min(1)).optional(),
});

bundlesRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const isAdmin = (req as AuthRequest).user?.role === "ADMIN";
    if (isAdmin) {
      const cached = adminBundlesListCache.get();
      if (cached) {
        res.setHeader("Cache-Control", "private, max-age=15");
        res.json(ok(cached));
        return;
      }
    }
    // List view only needs counts — skip nested product payloads (slow over pooler).
    const bundles = await prisma.bundle.findMany({
      where: isAdmin ? undefined : { status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    });
    const payload = {
      bundles: bundles.map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        slug: bundle.slug,
        description: bundle.description,
        shortDescription: bundle.shortDescription,
        status: bundle.status,
        priceCents: bundle.priceCents,
        currency: bundle.currency,
        thumbnailUrl: bundle.thumbnailUrl,
        icon: bundle.icon,
        displayOrder: bundle.displayOrder,
        metadata: bundle.metadata,
        createdAt: bundle.createdAt,
        updatedAt: bundle.updatedAt,
        productCount: bundle._count.items,
        published: bundle.status === "ACTIVE",
      })),
    };
    if (isAdmin) adminBundlesListCache.set(payload);
    res.setHeader("Cache-Control", "private, max-age=15");
    res.json(ok(payload));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.get("/:idOrSlug", authenticate, async (req, res, next) => {
  try {
    const key = req.params.idOrSlug;
    const isAdmin = (req as AuthRequest).user?.role === "ADMIN";
    const bundle = await prisma.bundle.findFirst({
      where: {
        OR: [{ id: key }, { slug: key }],
        ...(isAdmin ? {} : { status: "ACTIVE" }),
      },
      include: bundleInclude,
    });
    assertFound(bundle, "Bundle not found");
    res.json(ok({ bundle: serializeBundle(bundle) }));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createBundleSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const body = req.body as z.infer<typeof createBundleSchema>;
      const slug = body.slug ?? slugify(body.name);
      if (await prisma.bundle.findUnique({ where: { slug } })) {
        throw new AppError(409, "Bundle slug already exists", "SLUG_TAKEN");
      }

      const productIds = [...new Set(body.productIds ?? [])];
      if (body.status === "ACTIVE") {
        if (!productIds.length) {
          throw new AppError(400, "Published bundles need at least one product", "EMPTY_BUNDLE");
        }
        if (body.priceCents == null) {
          throw new AppError(400, "Published bundles need a price", "PRICE_REQUIRED");
        }
      }
      await assertApprovedProducts(productIds);

      const bundle = await prisma.bundle.create({
        data: {
          name: body.name,
          slug,
          description: body.description ?? null,
          shortDescription: body.shortDescription ?? null,
          priceCents: body.priceCents ?? null,
          currency: body.currency ?? "USD",
          status: body.status ?? "DRAFT",
          icon: body.icon ?? null,
          thumbnailUrl: body.thumbnailUrl || null,
          displayOrder: body.displayOrder ?? 0,
          items: {
            create: productIds.map((productId, index) => ({
              productId,
              sortOrder: index,
            })),
          },
        },
        include: bundleInclude,
      });

      await writeAuditLog({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: "bundle.created",
        entityType: "Bundle",
        entityId: bundle.id,
        metadata: { slug: bundle.slug, productIds },
      });

      bustBundlesListCache();
      res.status(201).json(ok({ bundle: serializeBundle(bundle) }));
    } catch (err) {
      next(err);
    }
  }
);

bundlesRouter.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateBundleSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.bundle.findUnique({ where: { id: req.params.id } });
      assertFound(existing, "Bundle not found");
      const body = req.body as z.infer<typeof updateBundleSchema>;

      if (body.slug && body.slug !== existing.slug) {
        const clash = await prisma.bundle.findUnique({ where: { slug: body.slug } });
        if (clash) throw new AppError(409, "Bundle slug already exists", "SLUG_TAKEN");
      }

      const nextStatus = body.status ?? existing.status;
      const productIds =
        body.productIds !== undefined ? [...new Set(body.productIds)] : undefined;

      if (nextStatus === "ACTIVE") {
        const count =
          productIds?.length ??
          (await prisma.bundleItem.count({ where: { bundleId: existing.id } }));
        const price = body.priceCents !== undefined ? body.priceCents : existing.priceCents;
        if (!count) {
          throw new AppError(400, "Published bundles need at least one product", "EMPTY_BUNDLE");
        }
        if (price == null) {
          throw new AppError(400, "Published bundles need a price", "PRICE_REQUIRED");
        }
      }

      if (productIds) await assertApprovedProducts(productIds);

      const bundle = await prisma.$transaction(async (tx) => {
        if (productIds) {
          await tx.bundleItem.deleteMany({ where: { bundleId: existing.id } });
          if (productIds.length) {
            await tx.bundleItem.createMany({
              data: productIds.map((productId, index) => ({
                bundleId: existing.id,
                productId,
                sortOrder: index,
              })),
            });
          }
        }

        return tx.bundle.update({
          where: { id: existing.id },
          data: {
            name: body.name ?? undefined,
            slug: body.slug ?? undefined,
            description: body.description === undefined ? undefined : body.description,
            shortDescription:
              body.shortDescription === undefined ? undefined : body.shortDescription,
            priceCents: body.priceCents === undefined ? undefined : body.priceCents,
            currency: body.currency ?? undefined,
            status: body.status ?? undefined,
            icon: body.icon === undefined ? undefined : body.icon,
            thumbnailUrl:
              body.thumbnailUrl === undefined
                ? undefined
                : body.thumbnailUrl || null,
            displayOrder: body.displayOrder ?? undefined,
          },
          include: bundleInclude,
        });
      });

      await writeAuditLog({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: "bundle.updated",
        entityType: "Bundle",
        entityId: bundle.id,
        metadata: { slug: bundle.slug, status: bundle.status },
      });

      bustBundlesListCache();
      res.json(ok({ bundle: serializeBundle(bundle) }));
    } catch (err) {
      next(err);
    }
  }
);

bundlesRouter.post("/:id/publish", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.bundle.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    assertFound(existing, "Bundle not found");
    if (!existing.items.length) {
      throw new AppError(400, "Published bundles need at least one product", "EMPTY_BUNDLE");
    }
    if (existing.priceCents == null) {
      throw new AppError(400, "Published bundles need a price", "PRICE_REQUIRED");
    }
    const bundle = await prisma.bundle.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" },
      include: bundleInclude,
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "bundle.published",
      entityType: "Bundle",
      entityId: bundle.id,
    });
    bustBundlesListCache();
    res.json(ok({ bundle: serializeBundle(bundle) }));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.post("/:id/unpublish", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.bundle.findUnique({ where: { id: req.params.id } });
    assertFound(existing, "Bundle not found");
    const bundle = await prisma.bundle.update({
      where: { id: existing.id },
      data: { status: "DRAFT" },
      include: bundleInclude,
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "bundle.unpublished",
      entityType: "Bundle",
      entityId: bundle.id,
    });
    bustBundlesListCache();
    res.json(ok({ bundle: serializeBundle(bundle) }));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.post("/:id/duplicate", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.bundle.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    assertFound(existing, "Bundle not found");
    let slug = `${existing.slug}-copy`;
    let n = 2;
    while (await prisma.bundle.findUnique({ where: { slug } })) {
      slug = `${existing.slug}-copy-${n++}`;
    }
    const bundle = await prisma.bundle.create({
      data: {
        name: `${existing.name} (Copy)`,
        slug,
        description: existing.description,
        shortDescription: existing.shortDescription,
        priceCents: existing.priceCents,
        currency: existing.currency,
        status: "DRAFT",
        icon: existing.icon,
        thumbnailUrl: existing.thumbnailUrl,
        displayOrder: existing.displayOrder,
        metadata: existing.metadata ?? undefined,
        items: {
          create: existing.items.map((item, index) => ({
            productId: item.productId,
            sortOrder: index,
          })),
        },
      },
      include: bundleInclude,
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "bundle.duplicated",
      entityType: "Bundle",
      entityId: bundle.id,
      metadata: { from: existing.id },
    });
    bustBundlesListCache();
    res.status(201).json(ok({ bundle: serializeBundle(bundle) }));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.delete("/:id", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.bundle.findUnique({ where: { id: req.params.id } });
    assertFound(existing, "Bundle not found");
    // Prefer archive over hard delete (purchases may reference bundle)
    const bundle = await prisma.bundle.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED" },
      include: bundleInclude,
    });
    await writeAuditLog({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "bundle.archived",
      entityType: "Bundle",
      entityId: bundle.id,
    });
    bustBundlesListCache();
    res.json(ok({ bundle: serializeBundle(bundle), message: "Bundle archived" }));
  } catch (err) {
    next(err);
  }
});

bundlesRouter.put(
  "/:id/price",
  authenticate,
  requireAdmin,
  validate(
    z.object({
      priceCents: z.number().int().min(0).nullable(),
      currency: z.string().length(3).optional(),
    })
  ),
  async (req: AuthRequest, res, next) => {
    try {
      const existing = await prisma.bundle.findUnique({ where: { id: req.params.id } });
      assertFound(existing, "Bundle not found");
      const body = req.body as { priceCents: number | null; currency?: string };
      const bundle = await prisma.bundle.update({
        where: { id: existing.id },
        data: {
          priceCents: body.priceCents,
          currency: body.currency ?? existing.currency,
        },
        include: bundleInclude,
      });
      await writeAuditLog({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: "bundle.price_changed",
        entityType: "Bundle",
        entityId: bundle.id,
        metadata: { priceCents: body.priceCents, currency: bundle.currency },
      });
      bustBundlesListCache();
      res.json(ok({ bundle: serializeBundle(bundle) }));
    } catch (err) {
      next(err);
    }
  }
);
