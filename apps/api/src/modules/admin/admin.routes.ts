import { Router } from "express";
import { prisma } from "@aes/database";
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
    const demoUserFilter = {
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
    } as const;

    const [
      customersWithAccess,
      publishedProducts,
      draftProducts,
      productsCount,
      bundlesCount,
      accessCount,
      newInquiries,
      totalInquiries,
      resellerLeads,
      recentCustomers,
      recentProducts,
    ] = await Promise.all([
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
        recentUsers: recentCustomers.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
          agencies: u.productAccess.map((a) => a.product.name),
        })),
        recentProducts,
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
