import { Router } from "express";
import { z } from "zod";
import { prisma, ProductStatus, ProductResourceType } from "@aes/database";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { userHasProductAccess } from "../access/access.routes";
import {
  APPROVED_PRODUCT_SLUGS,
  containsForbiddenScopeTerm,
  isApprovedProductSlug,
} from "../../constants/product-scope";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const productIncludeCounts = {
  _count: {
    select: {
      resources: true,
      workflows: true,
    },
  },
} as const;

function mapProductCard(product: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  tagline: string | null;
  status: ProductStatus;
  priceCents: number | null;
  currency: string;
  thumbnailUrl: string | null;
  icon: string | null;
  _count?: { resources: number; workflows: number };
}) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    tagline: product.tagline,
    status: product.status,
    priceCents: product.priceCents,
    currency: product.currency,
    thumbnailUrl: product.thumbnailUrl,
    icon: product.icon,
    resourceCount: product._count?.resources ?? 0,
    workflowCount: product._count?.workflows ?? 0,
  };
}

async function findProductByIdOrSlug(key: string) {
  return prisma.product.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
  });
}

async function assertCanViewProduct(
  userId: string,
  role: string,
  productId: string
) {
  const allowed = await userHasProductAccess(userId, productId, role);
  if (!allowed) {
    throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
  }
}

export const productsRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(10000).optional(),
  shortDescription: z.string().max(500).optional().nullable(),
  tagline: z.string().max(300).optional().nullable(),
  thumbnailUrl: z.string().max(2000).optional().nullable(),
  icon: z.string().max(64).optional().nullable(),
  priceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).default("USD"),
  status: z.nativeEnum(ProductStatus).optional(),
  configuration: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProductSchema = createProductSchema.partial();

const resourceSchema = z.object({
  type: z.nativeEnum(ProductResourceType),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(2000).optional(),
  content: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

const workflowSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  purpose: z.string().max(2000).optional(),
  displayOrder: z.number().int().optional(),
  inputs: z.unknown().optional(),
  outputDefinition: z.unknown().optional(),
  reviewRequirements: z.unknown().optional(),
  steps: z.unknown().optional(),
  isActive: z.boolean().optional(),
  serviceResourceId: z.string().min(1).optional().nullable(),
  contentPending: z.boolean().optional(),
});

/**
 * Products the current user is authorized to open in the app.
 * Entitlement-only for every role (including ADMIN) — full catalog is Admin → Products.
 */
productsRouter.get("/available", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { loadEntitledProductAccess } = await import("../access/entitlements");
    const access = await loadEntitledProductAccess(req.user!.id);
    const products = access.map((a) => mapProductCard(a.product));
    res.json(ok({ products }));
  } catch (err) {
    next(err);
  }
});

/**
 * Full agency library for the Products page:
 * all published agencies + locked/owned state for the signed-in user.
 */
productsRouter.get("/library", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { loadEntitledProductAccess } = await import("../access/entitlements");
    const access = await loadEntitledProductAccess(req.user!.id);
    const ownedById = new Map(access.map((a) => [a.productId, a]));

    const products = await prisma.product.findMany({
      where: {
        slug: { in: [...APPROVED_PRODUCT_SLUGS] },
        status: "PUBLISHED",
      },
      orderBy: { name: "asc" },
      include: productIncludeCounts,
    });

    const suiteAccess = await prisma.bundleAccess.findFirst({
      where: {
        userId: req.user!.id,
        status: "ACTIVE",
        bundle: { slug: "ai-enterprise-studio-complete-suite" },
      },
    });

    res.json(
      ok({
        products: products.map((product) => {
          const row = ownedById.get(product.id);
          const owned = Boolean(row);
          let accessLabel = "Locked — purchase to unlock";
          if (owned) {
            if (suiteAccess || row?.bundle?.slug === "ai-enterprise-studio-complete-suite") {
              accessLabel = "Included in Complete Suite";
            } else if (row?.source === "BUNDLE") {
              accessLabel = row.bundle?.name
                ? `Included in ${row.bundle.name}`
                : "Included in bundle";
            } else if (row?.source === "ADMIN_GRANT") {
              accessLabel = "Admin grant";
            } else {
              accessLabel = "Purchased";
            }
          }
          return {
            ...mapProductCard(product),
            owned,
            locked: !owned,
            accessSource: row?.source ?? null,
            accessLabel,
          };
        }),
        ownedCount: access.length,
        totalCount: products.length,
      })
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Product list.
 * ADMIN → full approved catalog (admin management UI).
 * USER → entitlement-only (same as /available). Never the full marketplace on the user app.
 */
productsRouter.get("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.user!.role === "ADMIN";
    if (isAdmin) {
      const products = await prisma.product.findMany({
        where: {
          slug: { in: [...APPROVED_PRODUCT_SLUGS] },
          status: { not: "ARCHIVED" },
        },
        orderBy: { name: "asc" },
        include: productIncludeCounts,
      });
      return res.json(ok({ products: products.map(mapProductCard) }));
    }

    const { loadEntitledProductAccess } = await import("../access/entitlements");
    const access = await loadEntitledProductAccess(req.user!.id);
    res.json(ok({ products: access.map((a) => mapProductCard(a.product)) }));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:idOrSlug/services", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const product = await findProductByIdOrSlug(req.params.idOrSlug);
    assertFound(product, "Product not found");
    await assertCanViewProduct(req.user!.id, req.user!.role, product.id);

    const services = await prisma.productResource.findMany({
      where: {
        productId: product.id,
        type: "SERVICE",
        ...(req.user!.role === "ADMIN" ? {} : { isPublished: true }),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { workflows: true } },
      },
    });
    res.json(
      ok({
        services: services.map((s) => ({
          ...s,
          workflowCount: s._count.workflows,
        })),
      })
    );
  } catch (err) {
    next(err);
  }
});

productsRouter.get(
  "/:idOrSlug/services/:serviceIdOrSlug/workflows",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const product = await findProductByIdOrSlug(req.params.idOrSlug);
      assertFound(product, "Product not found");
      await assertCanViewProduct(req.user!.id, req.user!.role, product.id);

      const service = await prisma.productResource.findFirst({
        where: {
          productId: product.id,
          type: "SERVICE",
          OR: [{ id: req.params.serviceIdOrSlug }, { slug: req.params.serviceIdOrSlug }],
        },
      });
      assertFound(service, "Service not found");

      const workflows = await prisma.workflowDefinition.findMany({
        where: {
          productId: product.id,
          serviceResourceId: service.id,
          ...(req.user!.role === "ADMIN" ? {} : { isActive: true }),
        },
        orderBy: { name: "asc" },
      });
      res.json(ok({ service, workflows }));
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.get("/:idOrSlug/workflows", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const product = await findProductByIdOrSlug(req.params.idOrSlug);
    assertFound(product, "Product not found");
    await assertCanViewProduct(req.user!.id, req.user!.role, product.id);

    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const serviceSlug =
      typeof req.query.serviceSlug === "string" ? req.query.serviceSlug : undefined;

    let serviceResourceId: string | undefined = serviceId;
    if (!serviceResourceId && serviceSlug) {
      const service = await prisma.productResource.findFirst({
        where: { productId: product.id, type: "SERVICE", slug: serviceSlug },
      });
      assertFound(service, "Service not found");
      serviceResourceId = service.id;
    }

    const workflows = await prisma.workflowDefinition.findMany({
      where: {
        productId: product.id,
        ...(serviceResourceId ? { serviceResourceId } : {}),
        ...(req.user!.role === "ADMIN" ? {} : { isActive: true }),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    res.json(ok({ workflows }));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:idOrSlug/resources", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const product = await findProductByIdOrSlug(req.params.idOrSlug);
    assertFound(product, "Product not found");
    await assertCanViewProduct(req.user!.id, req.user!.role, product.id);

    const typeFilter = req.query.type as string | undefined;
    const resources = await prisma.productResource.findMany({
      where: {
        productId: product.id,
        ...(typeFilter
          ? { type: typeFilter as ProductResourceType }
          : { type: { not: "SERVICE" } }),
        ...(req.user!.role === "ADMIN" ? {} : { isPublished: true }),
      },
      orderBy: { sortOrder: "asc" },
    });
    res.json(ok({ resources }));
  } catch (err) {
    next(err);
  }
});

/** Product workspace — services + resources; workflows load lazily by service. */
productsRouter.get("/:idOrSlug", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const key = req.params.idOrSlug;
    const includeWorkflows = req.query.include === "workflows";

    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: key }, { slug: key }],
      },
      include: {
        resources: {
          where: req.user!.role === "ADMIN" ? undefined : { isPublished: true },
          orderBy: { sortOrder: "asc" },
        },
        workflows: includeWorkflows
          ? { where: { isActive: true }, orderBy: { name: "asc" }, take: 50 }
          : false,
        _count: { select: { resources: true, workflows: true } },
      },
    });
    assertFound(product, "Product not found");

    if (product.status !== "PUBLISHED" && req.user!.role !== "ADMIN") {
      throw new AppError(404, "Product not found", "NOT_FOUND");
    }

    if (!(APPROVED_PRODUCT_SLUGS as readonly string[]).includes(product.slug) && req.user!.role !== "ADMIN") {
      throw new AppError(404, "Product not found", "NOT_FOUND");
    }

    const hasAccess = await userHasProductAccess(req.user!.id, product.id, req.user!.role);

    const services = product.resources.filter((r) => r.type === "SERVICE");
    const resourceLibrary = product.resources.filter((r) => r.type !== "SERVICE");
    const configuration =
      product.configuration && typeof product.configuration === "object"
        ? (product.configuration as Record<string, unknown>)
        : {};
    const workflowCatalog =
      configuration.workflowCatalog && typeof configuration.workflowCatalog === "object"
        ? configuration.workflowCatalog
        : {
            targetCount: 0,
            definedCount: product._count.workflows,
            status: "STRUCTURE_READY",
          };

    // Locked preview — marketing/summary only, no workspace payload
    if (!hasAccess) {
      res.json(
        ok({
          hasAccess: false,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            shortDescription: product.shortDescription,
            tagline: product.tagline,
            status: product.status,
            icon: product.icon,
            thumbnailUrl: product.thumbnailUrl,
            priceCents: product.priceCents,
            currency: product.currency,
            configuration: {
              accent: configuration.accent ?? null,
              category: configuration.category ?? null,
              sortOrder: configuration.sortOrder ?? null,
            },
            serviceCount: services.length,
            workflowCount: product._count.workflows,
            services: services.map((s) => ({
              id: s.id,
              title: s.title,
              slug: s.slug,
              description: s.description,
              sortOrder: s.sortOrder,
            })),
            resources: [],
            workflows: [],
            resourceCount: product._count.resources,
          },
        })
      );
      return;
    }

    const resourceCategories = [
      "OPERATOR_GUIDE",
      "SALES_PAGE",
      "SALES_COPY",
      "POSITIONING",
      "BUSINESS_STRATEGY",
    ].map((type) => ({
      type,
      present: resourceLibrary.some((r) => r.type === type),
      count: resourceLibrary.filter((r) => r.type === type).length,
    }));

    res.json(
      ok({
        hasAccess: true,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          shortDescription: product.shortDescription,
          tagline: product.tagline,
          status: product.status,
          icon: product.icon,
          thumbnailUrl: product.thumbnailUrl,
          priceCents: product.priceCents,
          currency: product.currency,
          configuration: product.configuration,
          metadata: product.metadata,
          serviceCount: services.length,
          workflowCount: product._count.workflows,
          resourceCount: resourceLibrary.length,
          services,
          resources: resourceLibrary,
          resourceLibrary,
          resourceCategories,
          workflowCatalog: {
            ...(workflowCatalog as object),
            definedCount: product._count.workflows,
          },
          agencyBuilder:
            configuration.agencyBuilder && typeof configuration.agencyBuilder === "object"
              ? configuration.agencyBuilder
              : null,
          workflows: includeWorkflows && Array.isArray(product.workflows) ? product.workflows : undefined,
        },
      })
    );
  } catch (err) {
    next(err);
  }
});

productsRouter.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createProductSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createProductSchema>;
      const slug = body.slug ?? slugify(body.name);
      if (!isApprovedProductSlug(slug)) {
        throw new AppError(
          400,
          "Only the approved 10 AI Enterprise Studio products may be created",
          "PRODUCT_SCOPE"
        );
      }
      const forbidden =
        containsForbiddenScopeTerm(body.name) || containsForbiddenScopeTerm(slug);
      if (forbidden) {
        throw new AppError(
          400,
          `Forbidden product scope term: ${forbidden}`,
          "PRODUCT_SCOPE"
        );
      }
      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing) throw new AppError(409, "Product slug already exists", "SLUG_TAKEN");

      const product = await prisma.product.create({
        data: {
          name: body.name,
          slug,
          description: body.description,
          shortDescription: body.shortDescription ?? null,
          tagline: body.tagline ?? null,
          thumbnailUrl: body.thumbnailUrl ?? null,
          icon: body.icon ?? null,
          priceCents: body.priceCents ?? null,
          currency: body.currency ?? "USD",
          status: body.status ?? "DRAFT",
          configuration: body.configuration as object | undefined,
          metadata: body.metadata as object | undefined,
        },
      });
      res.status(201).json(ok({ product }));
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.patch(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateProductSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const before = await prisma.product.findUnique({ where: { id: req.params.id } });
      assertFound(before, "Product not found");
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: req.body,
      });
      if (
        req.body.priceCents !== undefined &&
        req.body.priceCents !== before.priceCents
      ) {
        const { writeAuditLog } = await import("../audit/audit");
        await writeAuditLog({
          actorId: req.user?.id,
          actorEmail: req.user?.email,
          action: "product.price_changed",
          entityType: "Product",
          entityId: product.id,
          metadata: {
            from: before.priceCents,
            to: product.priceCents,
            currency: product.currency,
          },
        });
      }
      res.json(ok({ product }));
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.post(
  "/:id/resources",
  authenticate,
  requireAdmin,
  validate(resourceSchema),
  async (req, res, next) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      assertFound(product, "Product not found");
      const body = req.body as z.infer<typeof resourceSchema>;
      const slug = body.slug ?? slugify(body.title);
      const resource = await prisma.productResource.create({
        data: {
          productId: product.id,
          type: body.type,
          title: body.title,
          slug,
          description: body.description,
          content: body.content as object | undefined,
          sortOrder: body.sortOrder ?? 0,
          isPublished: body.isPublished ?? false,
        },
      });
      res.status(201).json(ok({ resource }));
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.post(
  "/:id/workflows",
  authenticate,
  requireAdmin,
  validate(workflowSchema),
  async (req, res, next) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      assertFound(product, "Product not found");
      const body = req.body as z.infer<typeof workflowSchema>;
      const key = body.key ?? slugify(body.name);
      const workflow = await prisma.workflowDefinition.create({
        data: {
          productId: product.id,
          serviceResourceId: body.serviceResourceId ?? null,
          key,
          name: body.name,
          description: body.description,
          purpose: body.purpose,
          displayOrder: body.displayOrder ?? 0,
          inputs: body.inputs as object | undefined,
          outputDefinition: body.outputDefinition as object | undefined,
          reviewRequirements: body.reviewRequirements as object | undefined,
          steps: body.steps as object | undefined,
          isActive: body.isActive ?? true,
          contentPending: body.contentPending ?? false,
        },
      });
      res.status(201).json(ok({ workflow }));
    } catch (err) {
      next(err);
    }
  }
);

productsRouter.post(
  "/:id/publish",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: { status: "PUBLISHED" },
      });
      res.json(ok({ product }));
    } catch (err) {
      next(err);
    }
  }
);
