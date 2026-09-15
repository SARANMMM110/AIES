import { Router } from "express";
import { z } from "zod";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { userHasProductAccess } from "../access/access.routes";

const AI_PLATFORMS = ["ChatGPT", "Claude", "Gemini", "Custom / Other"] as const;

export const agencySetupRouter = Router({ mergeParams: true });

agencySetupRouter.use(authenticate);

async function loadAccessibleProduct(req: AuthRequest, idOrSlug: string) {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  assertFound(product, "Product not found");
  if (req.user!.role !== "ADMIN") {
    if (product.status !== "PUBLISHED") {
      throw new AppError(404, "Product not found", "NOT_FOUND");
    }
    const allowed = await userHasProductAccess(req.user!.id, product.id, req.user!.role);
    if (!allowed) {
      throw new AppError(403, "No access to this product", "PRODUCT_ACCESS_DENIED");
    }
  }
  return product;
}

const setupSchema = z.object({
  aiPlatform: z.enum(AI_PLATFORMS).nullable().optional(),
  agencyName: z.string().max(200).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  targetNiche: z.string().max(300).nullable().optional(),
  geographicServiceArea: z.string().max(300).nullable().optional(),
  experienceLevel: z.string().max(120).nullable().optional(),
  preferredDeliveryModel: z.string().max(200).nullable().optional(),
  weeklyTimeAvailability: z.string().max(120).nullable().optional(),
  monthlyIncomeOrClientTarget: z.string().max(200).nullable().optional(),
  selectedServiceIds: z.array(z.string().min(1)).optional(),
  extras: z.record(z.unknown()).optional(),
});

agencySetupRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const product = await loadAccessibleProduct(req, req.params.idOrSlug);
    const config = await prisma.userProductConfig.findUnique({
      where: {
        userId_productId: { userId: req.user!.id, productId: product.id },
      },
    });
    const services = await prisma.productResource.findMany({
      where: { productId: product.id, type: "SERVICE", isPublished: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true, description: true },
    });
    res.json(
      ok({
        product: { id: product.id, name: product.name, slug: product.slug },
        aiPlatforms: AI_PLATFORMS,
        services,
        config: config
          ? {
              ...config,
              selectedServiceIds: Array.isArray(config.selectedServiceIds)
                ? config.selectedServiceIds
                : [],
            }
          : {
              aiPlatform: null,
              agencyName: null,
              country: null,
              targetNiche: null,
              geographicServiceArea: null,
              experienceLevel: null,
              preferredDeliveryModel: null,
              weeklyTimeAvailability: null,
              monthlyIncomeOrClientTarget: null,
              selectedServiceIds: [],
              extras: null,
            },
      })
    );
  } catch (err) {
    next(err);
  }
});

agencySetupRouter.put("/", validate(setupSchema), async (req: AuthRequest, res, next) => {
  try {
    const product = await loadAccessibleProduct(req, req.params.idOrSlug);
    const body = req.body as z.infer<typeof setupSchema>;

    if (body.selectedServiceIds?.length) {
      const count = await prisma.productResource.count({
        where: {
          productId: product.id,
          type: "SERVICE",
          id: { in: body.selectedServiceIds },
        },
      });
      if (count !== body.selectedServiceIds.length) {
        throw new AppError(400, "One or more selected services are invalid", "INVALID_SERVICES");
      }
    }

    const config = await prisma.userProductConfig.upsert({
      where: {
        userId_productId: { userId: req.user!.id, productId: product.id },
      },
      update: {
        aiPlatform: body.aiPlatform ?? undefined,
        agencyName: body.agencyName ?? undefined,
        country: body.country ?? undefined,
        targetNiche: body.targetNiche ?? undefined,
        geographicServiceArea: body.geographicServiceArea ?? undefined,
        experienceLevel: body.experienceLevel ?? undefined,
        preferredDeliveryModel: body.preferredDeliveryModel ?? undefined,
        weeklyTimeAvailability: body.weeklyTimeAvailability ?? undefined,
        monthlyIncomeOrClientTarget: body.monthlyIncomeOrClientTarget ?? undefined,
        selectedServiceIds: body.selectedServiceIds ?? undefined,
        extras: body.extras as object | undefined,
      },
      create: {
        userId: req.user!.id,
        productId: product.id,
        aiPlatform: body.aiPlatform ?? null,
        agencyName: body.agencyName ?? null,
        country: body.country ?? null,
        targetNiche: body.targetNiche ?? null,
        geographicServiceArea: body.geographicServiceArea ?? null,
        experienceLevel: body.experienceLevel ?? null,
        preferredDeliveryModel: body.preferredDeliveryModel ?? null,
        weeklyTimeAvailability: body.weeklyTimeAvailability ?? null,
        monthlyIncomeOrClientTarget: body.monthlyIncomeOrClientTarget ?? null,
        selectedServiceIds: body.selectedServiceIds ?? [],
        extras: body.extras as object | undefined,
      },
    });

    res.json(ok({ config }));
  } catch (err) {
    next(err);
  }
});
