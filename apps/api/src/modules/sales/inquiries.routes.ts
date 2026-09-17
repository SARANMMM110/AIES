import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { writeAuditLog } from "../audit/audit";
import { COMPLETE_SUITE_SLUG } from "../catalog/catalog.routes";
import { sendNotification } from "../email/notifications";
import { notifyAdmins } from "../notifications/notify";
import { env } from "../../config/env";
import { createTtlCache } from "../../lib/ttl-cache";

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export const salesInquiriesRouter = Router();

const inquiriesListCache = createTtlCache<{
  aes: unknown[];
  reseller: unknown[];
  note: string;
  suiteSlug: string;
}>(20_000);

function bustInquiriesCache() {
  inquiriesListCache.clear();
}

salesInquiriesRouter.post(
  "/",
  rateLimit({ windowMs: 60_000, max: 8, name: "sales-inquiry" }),
  async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const firstName = clean(body.firstName, 60);
      const lastName = clean(body.lastName, 60);
      const email = clean(body.email, 120)?.toLowerCase() || null;
      if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(400, "Name and a valid email are required", "INVALID_INQUIRY");
      }

      let productId: string | null = null;
      let bundleId: string | null = null;
      let interest = clean(body.interest, 120);

      const productSlug = clean(body.productSlug, 120);
      const bundleSlug = clean(body.bundleSlug, 120);

      if (productSlug) {
        if (!(APPROVED_PRODUCT_SLUGS as readonly string[]).includes(productSlug)) {
          throw new AppError(404, "Agency not found", "NOT_FOUND");
        }
        const product = await prisma.product.findFirst({
          where: { slug: productSlug, status: "PUBLISHED" },
          select: { id: true, name: true },
        });
        if (!product) throw new AppError(404, "Agency not found", "NOT_FOUND");
        productId = product.id;
        interest = interest || product.name;
      }

      if (bundleSlug) {
        const bundle = await prisma.bundle.findFirst({
          where: { slug: bundleSlug, status: "ACTIVE" },
          select: { id: true, name: true },
        });
        if (!bundle) throw new AppError(404, "Bundle not found", "NOT_FOUND");
        bundleId = bundle.id;
        interest = interest || bundle.name;
      }

      if (!productId && !bundleId) {
        interest = interest || "AI Enterprise Studio";
      }

      const row = await prisma.salesInquiry.create({
        data: {
          productId,
          bundleId,
          interest,
          firstName,
          lastName,
          email,
          phone: clean(body.phone, 40),
          company: clean(body.company, 80),
          message: clean(body.message, 1000),
        },
      });
      bustInquiriesCache();

      // Fire-and-forget side effects — do not block the sales form response.
      void writeAuditLog({
        action: "sales.inquiry.created",
        entityType: "SalesInquiry",
        entityId: row.id,
        metadata: { email, productId, bundleId, interest },
      });
      void sendNotification({
        type: "sales_inquiry",
        to: env.AES_INQUIRY_NOTIFY_EMAIL,
        data: {
          interest: interest || "AI Enterprise Studio",
          firstName,
          lastName,
          email,
          phone: row.phone,
          company: row.company,
          message: row.message,
        },
      });
      const agencyLabel = interest || "an agency";
      void notifyAdmins({
        type: "sales_inquiry",
        title: `New agency request: ${agencyLabel}`,
        body: `${firstName} ${lastName} (${email}) sent purchase details.`,
        href: "/admin/inquiries",
        entityType: "SalesInquiry",
        entityId: row.id,
      });

      res.status(201).json(ok({ received: true }));
    } catch (err) {
      next(err);
    }
  }
);

salesInquiriesRouter.get("/", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const unfiltered = !status && !q;

    if (unfiltered) {
      const cached = inquiriesListCache.get();
      if (cached) {
        res.setHeader("Cache-Control", "private, max-age=10");
        res.json(ok(cached));
        return;
      }
    }

    const inquiryWhere = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
              { interest: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const resellerWhere = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [rows, resellerLeads] = await Promise.all([
      prisma.salesInquiry.findMany({
        where: inquiryWhere,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          bundle: {
            select: {
              id: true,
              name: true,
              slug: true,
              items: { select: { productId: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.resellerInquiry.findMany({
        where: resellerWhere,
        include: {
          profile: { select: { title: true, product: { select: { name: true } } } },
          offer: { select: { title: true } },
          reseller: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const emails = [...new Set(rows.map((row) => row.email.toLowerCase()))];
    const matchedUsers = emails.length
      ? await prisma.user.findMany({
          where: { email: { in: emails }, role: "USER" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            productAccess: {
              where: {
                status: "ACTIVE",
                OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
              },
              select: { productId: true },
            },
          },
        })
      : [];
    const userByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u]));

    const aes = rows.map((row) => {
      const match = userByEmail.get(row.email.toLowerCase()) || null;
      const requestedProductIds = [
        ...(row.productId ? [row.productId] : []),
        ...(row.bundle?.items.map((item) => item.productId) || []),
      ];
      const ownedIds = new Set(match?.productAccess.map((a) => a.productId) || []);
      const alreadyHasRequested =
        requestedProductIds.length > 0 && requestedProductIds.every((id) => ownedIds.has(id));

      return {
        ...row,
        matchedCustomer: match
          ? {
              id: match.id,
              email: match.email,
              firstName: match.firstName,
              lastName: match.lastName,
              alreadyHasRequested,
            }
          : null,
      };
    });

    const payload = {
      aes,
      reseller: resellerLeads.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        company: row.company,
        message: row.message,
        createdAt: row.createdAt,
        interest: row.profile?.title || row.offer?.title || "Reseller lead",
        product: row.profile?.product?.name || null,
        resellerEmail: row.reseller.email,
      })),
      note: "New leads need an account. Existing customers: open their access list and enable the requested agency.",
      suiteSlug: COMPLETE_SUITE_SLUG,
    };

    if (unfiltered) inquiriesListCache.set(payload);
    res.setHeader("Cache-Control", "private, max-age=10");
    res.json(ok(payload));
  } catch (err) {
    next(err);
  }
});

salesInquiriesRouter.patch("/:id", authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const status = clean(req.body?.status, 40);
    if (!status || !["NEW", "CONTACTED", "CLOSED"].includes(status)) {
      throw new AppError(400, "Status must be NEW, CONTACTED, or CLOSED", "INVALID_STATUS");
    }
    const row = await prisma.salesInquiry.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
    bustInquiriesCache();
    res.json(ok(row));
  } catch (err) {
    next(err);
  }
});
