import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { ok } from "../../utils/response";
import { loadEntitledProductAccess } from "../access/entitlements";

/**
 * Central dashboard summary for the authenticated user.
 * Product tiles are entitlement-only (purchases / grants / bundles) — never the full catalog.
 * Admins manage the full catalog under /admin/products.
 */
export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get("/summary", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";

    const accessRows = await loadEntitledProductAccess(userId);

    const suiteAccess = await prisma.bundleAccess.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        bundle: { slug: "ai-enterprise-studio-complete-suite" },
      },
    });

    const recentPurchases = await prisma.purchase.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            bundle: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    function accessLabel(row: (typeof accessRows)[number]): string {
      if (suiteAccess || row.bundle?.slug === "ai-enterprise-studio-complete-suite") {
        return "Included in Complete Suite";
      }
      if (row.source === "BUNDLE") {
        return row.bundle?.name ? `Included in ${row.bundle.name}` : "Included in bundle";
      }
      if (row.source === "ADMIN_GRANT") return "Admin grant";
      return "Purchased";
    }

    const entitledIds = accessRows.map((r) => r.productId);

    const recentProjects = await prisma.project.findMany({
      where: {
        ownerId: userId,
        ...(entitledIds.length
          ? { OR: [{ productId: null }, { productId: { in: entitledIds } }] }
          : { productId: null }),
      },
      include: {
        client: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, slug: true, icon: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    const recentActivity = await prisma.workflowProgress.findMany({
      where: {
        project: {
          ownerId: userId,
          ...(entitledIds.length
            ? { OR: [{ productId: null }, { productId: { in: entitledIds } }] }
            : {}),
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });

    const productList = accessRows.map((row) => row.product);

    const recentProductIds = [
      ...new Set(
        recentProjects.map((p) => p.productId).filter((id): id is string => Boolean(id))
      ),
    ].slice(0, 4);

    const recentlyUsed = productList.filter((p) => recentProductIds.includes(p.id));

    res.json(
      ok({
        user: {
          id: req.user!.id,
          firstName: req.user!.firstName,
          lastName: req.user!.lastName,
          email: req.user!.email,
          role: req.user!.role,
        },
        products: accessRows.map((row) => ({
          id: row.product.id,
          name: row.product.name,
          slug: row.product.slug,
          description: row.product.description,
          shortDescription: row.product.shortDescription,
          tagline: row.product.tagline,
          status: row.product.status,
          priceCents: row.product.priceCents,
          currency: row.product.currency,
          thumbnailUrl: row.product.thumbnailUrl,
          icon: row.product.icon,
          resourceCount: row.product._count.resources,
          workflowCount: row.product._count.workflows,
          accessSource: row.source,
          accessLabel: accessLabel(row),
        })),
        recentlyUsed,
        recentProjects,
        recentActivity,
        recentPurchases: recentPurchases.map((p) => ({
          id: p.id,
          code: p.code,
          status: p.status,
          purchaseType: p.purchaseType,
          totalAmount: p.totalAmount,
          currency: p.currency,
          createdAt: p.createdAt,
          items: p.items.map((i) => ({
            itemType: i.itemType,
            name: i.product?.name ?? i.bundle?.name ?? "Item",
            slug: i.product?.slug ?? i.bundle?.slug ?? null,
          })),
        })),
        counts: {
          products: accessRows.length,
          projects: recentProjects.length,
          activity: recentActivity.length,
          purchases: recentPurchases.length,
        },
        note: isAdmin
          ? "User dashboard shows only your entitlements. Manage the full catalog in Admin → Products."
          : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});
