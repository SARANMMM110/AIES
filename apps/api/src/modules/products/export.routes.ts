import { Router } from "express";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { AppError, assertFound } from "../../utils/errors";
import { ok } from "../../utils/response";
import { userHasProductAccess } from "../access/access.routes";
import { buildAgencyOneHtml } from "./agency-one-export";
import { buildPremiumSalesPageHtml } from "./premium-sales-export";

export const productExportRouter = Router({ mergeParams: true });

productExportRouter.use(authenticate);

productExportRouter.get("/standalone", async (req: AuthRequest, res, next) => {
  try {
    const key = req.params.idOrSlug;
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      include: {
        resources: {
          where: {
            type: "SERVICE",
            ...(req.user!.role === "ADMIN" ? {} : { isPublished: true }),
          },
          orderBy: { sortOrder: "asc" },
        },
        workflows: {
          where: req.user!.role === "ADMIN" ? undefined : { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
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

    const cfg =
      product.configuration && typeof product.configuration === "object"
        ? (product.configuration as Record<string, unknown>)
        : {};
    const accent =
      typeof cfg.accent === "string" && cfg.accent.startsWith("#")
        ? cfg.accent
        : "#2563EB";

    const html = buildAgencyOneHtml({
      name: product.name,
      slug: product.slug,
      tagline: product.tagline,
      shortDescription: product.shortDescription,
      description: product.description,
      accent,
      services: product.resources.map((r) => ({ id: r.id, title: r.title })),
      workflows: product.workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        purpose: w.purpose,
        serviceResourceId: w.serviceResourceId,
        aiInstructionTemplate: w.aiInstructionTemplate,
        outputDefinition: w.outputDefinition,
        nextAction: w.nextAction,
      })),
    });
    const format = typeof req.query.format === "string" ? req.query.format : "html";

    if (format === "json") {
      return res.json(
        ok({
          html,
          manifestMeta: {
            slug: product.slug,
            kind: "agency-one",
            workflowCount: product.workflows.length,
            serviceCount: product.resources.length,
            bytes: Buffer.byteLength(html, "utf8"),
          },
        })
      );
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${product.slug}.html"`
    );
    res.send(html);
  } catch (err) {
    next(err);
  }
});

/**
 * Client-facing sales page HTML export (marketing asset for this agency).
 */
productExportRouter.get("/sales-page", async (req: AuthRequest, res, next) => {
  try {
    const key = req.params.idOrSlug;
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      include: {
        resources: {
          where: {
            type: "SERVICE",
            ...(req.user!.role === "ADMIN" ? {} : { isPublished: true }),
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { workflows: true } },
      },
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

    const cfg =
      product.configuration && typeof product.configuration === "object"
        ? (product.configuration as Record<string, unknown>)
        : {};
    const accent =
      typeof cfg.accent === "string" && cfg.accent.startsWith("#")
        ? cfg.accent
        : "#caff45";

    // Downloadable HTML = premium template (exact layout from reference file).
    // In-app preview uses the separate React /sales/[slug] page.
    const html = buildPremiumSalesPageHtml({
      name: product.name,
      slug: product.slug,
      accent,
      services: product.resources.map((r) => r.title),
      serviceCount: product.resources.length,
      workflowCount: product._count.workflows,
      inquireEndpoint: `${env.API_URL}/api/sales/inquiries`,
      suiteUrl: `${env.APP_URL}/purchase?suite=1`,
    });

    const format = typeof req.query.format === "string" ? req.query.format : "html";
    if (format === "json") {
      return res.json(
        ok({
          html,
          meta: {
            slug: product.slug,
            kind: "sales-page",
            serviceCount: product.resources.length,
            workflowCount: product._count.workflows,
            bytes: Buffer.byteLength(html, "utf8"),
          },
        })
      );
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${product.slug}-sales-page.html"`
    );
    res.send(html);
  } catch (err) {
    next(err);
  }
});
