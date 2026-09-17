import { Router } from "express";
import { prisma, type Prisma } from "@aes/database";
import { authenticate, requireAdmin } from "../../middleware/auth";
import { ok } from "../../utils/response";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { adminResellerRouter } from "../reseller/admin.routes";
import { env, aiEnabled } from "../../config/env";

/**
 * Admin foundation — stats overview + navigation targets for later CRUD stages.
 */
export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);
adminRouter.use("/reseller", adminResellerRouter);

const catalogWhere = { slug: { in: [...APPROVED_PRODUCT_SLUGS] } };

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const demoUserFilter: Prisma.UserWhereInput = {
      NOT: {
        OR: [
          { email: { endsWith: "@test.local" } },
          { email: { contains: "sales-test-" } },
          { email: { endsWith: "@example.com" } },
          { email: "admin@aies.local" },
          { email: "user@aies.local" },
          { AND: [{ firstName: "Sales" }, { lastName: "Tester" }] },
          { AND: [{ firstName: "Stage" }, { lastName: "One" }] },
          { AND: [{ firstName: "Demo" }, { lastName: "User" }] },
          { AND: [{ firstName: "Phase" }, { lastName: "Six" }] },
          { AND: [{ firstName: "Platform" }, { lastName: "Admin" }] },
        ],
      },
    };

    const settled = await Promise.allSettled([
      prisma.productAccess
        .findMany({
          where: {
            status: "ACTIVE",
            OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
            user: { role: "USER", ...demoUserFilter },
          },
          distinct: ["userId"],
          select: { userId: true },
        })
        .then((rows) => rows.length),
      prisma.product.count({ where: { ...catalogWhere, status: "PUBLISHED" } }),
      prisma.product.count({ where: { ...catalogWhere, status: "DRAFT" } }),
      prisma.product.count({ where: catalogWhere }),
      prisma.bundle.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.productAccess.count({
        where: {
          status: "ACTIVE",
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          user: { role: "USER", ...demoUserFilter },
        },
      }),
      prisma.salesInquiry.count({ where: { status: "NEW" } }),
      prisma.salesInquiry.count(),
      prisma.resellerInquiry.count(),
      prisma.user.findMany({
        where: {
          role: "USER",
          ...demoUserFilter,
          productAccess: {
            some: {
              status: "ACTIVE",
              OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          productAccess: {
            where: {
              status: "ACTIVE",
              OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
            },
            select: { product: { select: { name: true } } },
            take: 6,
          },
        },
      }),
      prisma.product.findMany({
        where: catalogWhere,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          shortDescription: true,
          icon: true,
          updatedAt: true,
        },
      }),
    ]);

    const failed = settled
      .map((r, i) => (r.status === "rejected" ? { i, reason: String(r.reason) } : null))
      .filter(Boolean);
    if (failed.length) {
      console.error("[admin:dashboard] partial query failures", failed);
    }

    // If everything failed, surface the first error
    if (settled.every((r) => r.status === "rejected")) {
      throw (settled[0] as PromiseRejectedResult).reason;
    }

    const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === "fulfilled" ? r.value : fallback;

    const customersWithAccess = val(settled[0], 0);
    const publishedProducts = val(settled[1], 0);
    const draftProducts = val(settled[2], 0);
    const productsCount = val(settled[3], 0);
    const bundlesCount = val(settled[4], 0);
    const accessCount = val(settled[5], 0);
    const newInquiries = val(settled[6], 0);
    const totalInquiries = val(settled[7], 0);
    const resellerLeads = val(settled[8], 0);
    const recentUsersSafe = settled[9].status === "fulfilled" ? settled[9].value : [];
    const recentProductsSafe = settled[10].status === "fulfilled" ? settled[10].value : [];

    res.json(
      ok({
        stats: {
          users: customersWithAccess,
          products: productsCount,
          publishedProducts,
          draftProducts,
          bundles: bundlesCount,
          activeProductAccess: accessCount,
          newInquiries,
          totalInquiries,
          resellerLeads,
        },
        recentUsers: recentUsersSafe.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
          agencies: u.productAccess.map((a) => a.product.name),
        })),
        recentProducts: recentProductsSafe,
        navigation: [
          { href: "/admin", label: "Overview" },
          { href: "/admin/products", label: "Products" },
          { href: "/admin/bundles", label: "Bundles" },
          { href: "/admin/wiki", label: "Agency Wiki" },
          { href: "/admin/inquiries", label: "Inquiries" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/settings", label: "Settings" },
        ],
        capabilities: {
          manageUsers: true,
          manageProducts: true,
          manageProductAccess: true,
          manageBundles: true,
          manageBundleContents: true,
          managePurchases: true,
          manageInquiries: true,
        },
        note: "Customers are people with unlocked agency access. Create accounts from Inquiries.",
        ...(failed.length
          ? { warnings: failed.map((f) => (f as { reason: string }).reason).slice(0, 3) }
          : {}),
      })
    );
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/health", async (_req, res) => {
  res.json(
    ok({
      role: "ADMIN",
      message: "Admin access confirmed",
    })
  );
});

/** Probe Prisma models used by admin/sales routes — returns per-model ok/error. */
adminRouter.get("/schema-check", async (_req, res) => {
  const checks: Record<string, { ok: boolean; detail?: string; count?: number }> = {};
  const run = async (name: string, fn: () => Promise<number>) => {
    try {
      const count = await fn();
      checks[name] = { ok: true, count };
    } catch (e) {
      checks[name] = {
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  };

  await run("user", () => prisma.user.count());
  await run("product", () => prisma.product.count());
  await run("bundle", () => prisma.bundle.count());
  await run("productAccess", () => prisma.productAccess.count());
  await run("salesInquiry", () => prisma.salesInquiry.count());
  await run("resellerInquiry", () => prisma.resellerInquiry.count());
  await run("purchase", () => prisma.purchase.count());
  await run("purchaseItem", () => prisma.purchaseItem.count());
  await run("paymentEvent", () => prisma.paymentEvent.count());
  await run("resellerSale", () => prisma.resellerSale.count());
  await run("resellerOffer", () => prisma.resellerOffer.count());
  await run("notification", () => prisma.notification.count());
  await run("auditLog", () => prisma.auditLog.count());
  await run("client", () => prisma.client.count());
  await run("workflowDefinition", () => prisma.workflowDefinition.count());
  await run("wikiArticle", () => prisma.wikiArticle.count());

  // Nested query used by dashboard
  await run("dashboardRecentUsers", async () => {
    const rows = await prisma.user.findMany({
      where: { role: "USER" },
      take: 1,
      select: {
        id: true,
        productAccess: {
          take: 1,
          select: { product: { select: { name: true } } },
        },
      },
    });
    return rows.length;
  });

  const failed = Object.entries(checks)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => ({ model: k, error: v.detail }));

  res.status(failed.length ? 500 : 200).json(
    ok({
      ok: failed.length === 0,
      failed,
      checks,
    })
  );
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    const [
      users,
      products,
      bundles,
      aesInquiries,
      resellerInquiries,
      purchases,
      resellerSales,
      clients,
      projects,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: catalogWhere }),
      prisma.bundle.count(),
      prisma.salesInquiry.count(),
      prisma.resellerInquiry.count(),
      prisma.purchase.count(),
      prisma.resellerSale.count(),
      prisma.client.count(),
      prisma.project.count(),
    ]);

    res.json(
      ok({
        platform: {
          appName: env.APP_NAME,
          appUrl: env.APP_URL,
          apiUrl: env.API_URL,
          nodeEnv: env.NODE_ENV,
          paymentProvider: env.PAYMENT_PROVIDER,
          emailProvider: env.EMAIL_PROVIDER,
          emailFrom: env.EMAIL_FROM,
          inquiryNotifyEmail: env.AES_INQUIRY_NOTIFY_EMAIL,
          aiProvider: env.AI_PROVIDER,
          aiModel: env.AI_MODEL,
          aiConfigured: aiEnabled(),
        },
        counts: {
          users,
          products,
          bundles,
          aesInquiries,
          resellerInquiries,
          purchases,
          resellerSales,
          clients,
          projects,
        },
      })
    );
  } catch (err) {
    next(err);
  }
});
