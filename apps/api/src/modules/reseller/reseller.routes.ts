import { readFile } from "fs/promises";
import { Router } from "express";
import { prisma } from "@aes/database";
import { authenticate, type AuthRequest } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rateLimit";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { ok } from "../../utils/response";
import { writeAuditLog } from "../audit/audit";
import {
  loadBranding,
  publicBrandFor,
  readOwnedAsset,
  saveBranding,
  serializeBranding,
  storeBrandAsset,
  whiteLabelAllowed,
} from "./branding";
import {
  agencyDownloadHtml,
  createAgencyInquiry,
  deleteOwnedAgency,
  listAgencyChoices,
  listOwnedAgencies,
  listOwnedInquiries,
  publicAgencyPage,
  publishAgencyToWordPress,
  saveAgencyProfile,
  serializeProfile,
} from "./agencies";
import { listAccountResale, loadResellerRights, setAccountResale } from "./entitlements";
import { activateResellerCustomer, fulfillResellerSale } from "./fulfillment";
import { createResellerOffer, deleteOwnedOffer, serializeOffer, setOwnedOfferStatus, updateResellerOffer } from "./offers";
import { listOwnedOffers, listOwnedSales, recordOfferEvent, requireReseller, resellerAnalytics, resellerDashboard } from "./portal";
import {
  cancelResellerCheckout,
  getResellerCheckoutStatus,
  loadSellablePublicOffer,
  serializePublicOffer,
  startResellerCheckout,
} from "./checkout";

export const resellerRouter = Router();

resellerRouter.get(
  "/public/offers/:slug",
  rateLimit({ windowMs: 60_000, max: 60, name: "reseller-offer" }),
  async (req, res, next) => {
    try {
      const loaded = await loadSellablePublicOffer(req.params.slug);
      await recordOfferEvent(loaded.offer.id, loaded.offer.resellerUserId, "VIEW");
      await writeAuditLog({
        action: "reseller.offer.viewed",
        entityType: "ResellerOffer",
        entityId: loaded.offer.id,
        metadata: { slug: loaded.offer.slug },
      });
      res.json(ok(await serializePublicOffer(loaded)));
    } catch (err) {
      next(err);
    }
  }
);

resellerRouter.post(
  "/public/offers/:slug/checkout",
  rateLimit({ windowMs: 60_000, max: 12, name: "reseller-checkout" }),
  (_req, _res, next) => {
    next(
      new AppError(
        410,
        "Payment checkout is disabled. Use the inquiry form on this offer — the owner will follow up by email.",
        "PAYMENT_DISABLED"
      )
    );
  }
);

resellerRouter.post(
  "/public/offers/:slug/inquiry",
  rateLimit({ windowMs: 60_000, max: 8, name: "reseller-offer-inquiry" }),
  async (req, res, next) => {
    try {
      const offer = await prisma.resellerOffer.findFirst({
        where: { slug: req.params.slug, status: { in: ["PUBLISHED", "ACTIVE"] } },
        select: {
          id: true,
          title: true,
          resellerUserId: true,
          brandName: true,
        },
      });
      if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
      const body = req.body ?? {};
      const firstName = String(body.firstName || "").trim().slice(0, 60);
      const lastName = String(body.lastName || "").trim().slice(0, 60);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
      if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(400, "Name and a valid email are required", "INVALID_INQUIRY");
      }
      const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
      const company = body.company ? String(body.company).trim().slice(0, 80) : null;
      const message = body.message ? String(body.message).trim().slice(0, 1000) : null;
      const inquiry = await prisma.resellerInquiry.create({
        data: {
          resellerUserId: offer.resellerUserId,
          offerId: offer.id,
          firstName,
          lastName,
          email,
          phone,
          company,
          message,
        },
      });

      const branding = await prisma.resellerBranding.findUnique({
        where: { userId: offer.resellerUserId },
        select: { supportEmail: true, brandName: true },
      });
      const owner = await prisma.user.findUnique({
        where: { id: offer.resellerUserId },
        select: { email: true },
      });
      const notifyTo = branding?.supportEmail || owner?.email || null;
      if (notifyTo) {
        const { sendNotification } = await import("../email/notifications");
        await sendNotification({
          type: "reseller_inquiry",
          to: notifyTo,
          data: {
            interest: offer.brandName || branding?.brandName || offer.title,
            firstName,
            lastName,
            email,
            phone,
            company,
            message,
          },
        });
      }

      const { createAppNotification } = await import("../notifications/notify");
      await createAppNotification({
        userId: offer.resellerUserId,
        type: "reseller_inquiry",
        title: `New enquiry: ${offer.title}`,
        body: `${firstName} ${lastName} (${email}) sent details from your offer page.`,
        href: "/reseller/customers",
        entityType: "ResellerInquiry",
        entityId: inquiry.id,
      });

      res.status(201).json(ok({ received: true }));
    } catch (err) {
      next(err);
    }
  }
);

resellerRouter.post("/activate", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    const result = await activateResellerCustomer(token, password);
    res.json(ok(result));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/public/agencies/:slug", async (req, res, next) => {
  try {
    res.json(ok(await publicAgencyPage(req.params.slug)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post(
  "/public/agencies/:slug/inquiry",
  rateLimit({ windowMs: 60_000, max: 8, name: "reseller-inquiry" }),
  async (req, res, next) => {
    try {
      const body = req.body ?? {};
      await createAgencyInquiry(req.params.slug, {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        company: body.company,
        message: body.message,
      });
      res.status(201).json(ok({ received: true }));
    } catch (err) {
      next(err);
    }
  }
);

resellerRouter.get("/public/brand-assets/:userId/:filename", async (req, res, next) => {
  try {
    const file = await readOwnedAsset(req.params.userId, req.params.filename);
    const body = await readFile(file);
    const type = file.endsWith(".png")
      ? "image/png"
      : file.endsWith(".webp")
        ? "image/webp"
        : file.endsWith(".ico")
          ? "image/x-icon"
          : "image/jpeg";
    res.setHeader("Content-Type", type);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(body);
  } catch (err) {
    next(err);
  }
});

resellerRouter.use(authenticate);

async function ownedPreview(userId: string, offerId: string) {
  const offer = await prisma.resellerOffer.findFirst({
    where: { id: offerId, resellerUserId: userId },
    include: {
      entitlement: true,
      reseller: { select: { firstName: true, lastName: true } },
      products: {
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              shortDescription: true,
              status: true,
              resources: { where: { type: "SERVICE", isPublished: true }, select: { title: true }, take: 8 },
            },
          },
        },
      },
    },
  });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  const branded = await whiteLabelAllowed(offer.entitlement);
  const brand = await publicBrandFor(userId, branded);
  return {
    preview: true,
    slug: offer.slug,
    title: offer.title,
    description: offer.description,
    salesCopy: offer.salesCopy,
    ctaText: offer.ctaText || "Purchase",
    priceCents: offer.priceCents,
    currency: offer.currency,
    status: offer.status,
    brand,
    attribution: "Access is provided through AI Enterprise Studio.",
    products: offer.products.map((row) => ({
      name: row.product.name,
      slug: row.product.slug,
      shortDescription: row.product.shortDescription,
      services: row.product.resources.map((resource) => resource.title),
    })),
  };
}

resellerRouter.get("/account", async (req: AuthRequest, res, next) => {
  try {
    res.json(ok(await listAccountResale(req.user!.id)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.put("/account", async (req: AuthRequest, res, next) => {
  try {
    const body = req.body ?? {};
    const saved = await setAccountResale(req.user!.id, {
      key: String(body.key || ""),
      resell: Boolean(body.resell),
      whiteLabel: Boolean(body.whiteLabel),
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.entitlement.changed",
      entityType: "ResellerEntitlement",
      metadata: { key: saved.key, resell: saved.resell, whiteLabel: saved.whiteLabel },
    });
    res.json(ok(saved));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/me", async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const dashboard = await resellerDashboard(userId);
    res.json(ok(dashboard));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/entitlements", async (req: AuthRequest, res, next) => {
  try {
    const rights = await requireReseller(req.user!.id);
    const offers = await prisma.resellerOffer.findMany({
      where: { resellerUserId: req.user!.id },
      select: { entitlementId: true, status: true },
    });
    res.json(
      ok(
        rights.map((item) => ({
          ...item,
          canResell: item.status === "ACTIVE",
          canWhiteLabel: item.policy?.allowBranding === true,
          offers: offers.filter((offer) => offer.entitlementId === item.id).length,
          publishedOffers: offers.filter(
            (offer) => offer.entitlementId === item.id && (offer.status === "PUBLISHED" || offer.status === "ACTIVE")
          ).length,
        }))
      )
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/analytics", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    res.json(ok(await resellerAnalytics(req.user!.id)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/branding", async (req: AuthRequest, res, next) => {
  try {
    const rights = await requireReseller(req.user!.id);
    const branding = await loadBranding(req.user!.id);
    res.json(
      ok({
        canWhiteLabel: rights.some((item) => item.policy?.allowBranding === true),
        branding: serializeBranding(branding),
      })
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.put("/branding", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const body = req.body ?? {};
    const saved = await saveBranding(req.user!.id, body);
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.branding.changed",
      entityType: "ResellerBranding",
      entityId: saved.id,
    });
    res.json(ok(serializeBranding(saved)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/branding/logo", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const url = await storeBrandAsset(req.user!.id, "logo", String(req.body?.dataUrl || ""));
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.branding.changed",
      entityType: "ResellerBranding",
      metadata: { asset: "logo" },
    });
    res.json(ok({ logoUrl: `${env.API_URL}${url}` }));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/branding/favicon", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const url = await storeBrandAsset(req.user!.id, "favicon", String(req.body?.dataUrl || ""));
    res.json(ok({ faviconUrl: `${env.API_URL}${url}` }));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/agencies/choices", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    res.json(ok(await listAgencyChoices(req.user!.id)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/agencies", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const publishedOnly = req.query.published === "1";
    const rows = await listOwnedAgencies(req.user!.id, publishedOnly);
    res.json(ok(rows.map(serializeProfile)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/agencies", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const saved = await saveAgencyProfile(req.user!.id, req.body ?? {});
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.agency.saved",
      entityType: "ResellerAgencyProfile",
      entityId: saved.id,
      metadata: { published: saved.published, productId: saved.productId },
    });
    res.status(201).json(ok(serializeProfile(saved)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.put("/agencies/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const saved = await saveAgencyProfile(req.user!.id, { ...(req.body ?? {}), id: req.params.id });
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.agency.saved",
      entityType: "ResellerAgencyProfile",
      entityId: saved.id,
    });
    res.json(ok(serializeProfile(saved)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.delete("/agencies/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    await deleteOwnedAgency(req.user!.id, req.params.id);
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.agency.deleted",
      entityType: "ResellerAgencyProfile",
      entityId: req.params.id,
    });
    res.json(ok({ deleted: true }));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/agencies/:id/download", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const kind = req.query.kind === "agency" ? "agency" : "sales";
    const file = await agencyDownloadHtml(req.user!.id, req.params.id, kind);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.html);
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/agencies/:id/wordpress", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const body = req.body ?? {};
    const saved = await publishAgencyToWordPress(req.user!.id, req.params.id, {
      siteUrl: body.siteUrl,
      username: body.username,
      appPassword: body.appPassword,
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.agency.wordpress",
      entityType: "ResellerAgencyProfile",
      entityId: saved.id,
      metadata: { wordpressPageUrl: saved.wordpressPageUrl },
    });
    res.json(ok(serializeProfile(saved)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/offers", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const rows = await listOwnedOffers(req.user!.id);
    res.json(
      ok(
        rows.map((row) =>
          serializeOffer(row.offer, {
            customers: row.customers,
            sales: row.offer._count.sales,
            canSell: row.canSell,
            canWhiteLabel: row.canWhiteLabel,
          })
        )
      )
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/offers/:id/preview", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    res.json(ok(await ownedPreview(req.user!.id, req.params.id)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/offers/:id/publish", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const offer = await setOwnedOfferStatus(req.user!.id, req.params.id, "PUBLISHED");
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.published",
      entityType: "ResellerOffer",
      entityId: offer.id,
    });
    res.json(ok(serializeOffer(offer)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/offers/:id/unpublish", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const offer = await setOwnedOfferStatus(req.user!.id, req.params.id, "UNPUBLISHED");
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.unpublished",
      entityType: "ResellerOffer",
      entityId: offer.id,
    });
    res.json(ok(serializeOffer(offer)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/offers/:id/archive", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const offer = await setOwnedOfferStatus(req.user!.id, req.params.id, "ARCHIVED");
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.archived",
      entityType: "ResellerOffer",
      entityId: offer.id,
    });
    res.json(ok(serializeOffer(offer)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.delete("/offers/:id", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const deleted = await deleteOwnedOffer(req.user!.id, req.params.id);
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.deleted",
      entityType: "ResellerOffer",
      entityId: deleted.id,
    });
    res.json(ok({ deleted: true, id: deleted.id }));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/offers", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const body = req.body ?? {};
    const offer = await createResellerOffer(req.user!.id, {
      entitlementId: String(body.entitlementId || ""),
      title: String(body.title || ""),
      description: body.description ? String(body.description) : null,
      priceCents: Number(body.priceCents),
      productIds: Array.isArray(body.productIds) ? body.productIds.map(String) : undefined,
      brandName: body.brandName ? String(body.brandName) : null,
      brandLogoUrl: body.brandLogoUrl ? String(body.brandLogoUrl) : null,
      brandAccent: body.brandAccent ? String(body.brandAccent) : null,
      salesCopy: body.salesCopy ? String(body.salesCopy) : null,
      ctaText: body.ctaText ? String(body.ctaText) : null,
      currency: body.currency ? String(body.currency) : "USD",
      status: body.status,
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.created",
      entityType: "ResellerOffer",
      entityId: offer.id,
    });
    res.status(201).json(ok(serializeOffer(offer)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.patch("/offers/:id", async (req: AuthRequest, res, next) => {
  try {
    const body = req.body ?? {};
    const offer = await updateResellerOffer(req.user!.id, req.params.id, {
      entitlementId: body.entitlementId ? String(body.entitlementId) : undefined,
      title: body.title ? String(body.title) : undefined,
      description: body.description === undefined ? undefined : body.description,
      priceCents: body.priceCents === undefined ? undefined : Number(body.priceCents),
      productIds: Array.isArray(body.productIds) ? body.productIds.map(String) : undefined,
      brandName: body.brandName,
      brandLogoUrl: body.brandLogoUrl,
      brandAccent: body.brandAccent,
      salesCopy: body.salesCopy,
      ctaText: body.ctaText,
      currency: body.currency,
      status: body.status,
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: "reseller.offer.edited",
      entityType: "ResellerOffer",
      entityId: offer.id,
    });
    res.json(ok(serializeOffer(offer)));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/customers", async (req: AuthRequest, res, next) => {
  try {
    const rights = await loadResellerRights(req.user!.id);
    if (!rights.length) {
      res.json(ok([]));
      return;
    }
    const [customers, inquiries] = await Promise.all([
      prisma.resellerCustomer.findMany({
        where: { resellerUserId: req.user!.id },
        include: {
          sales: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              offer: { select: { title: true } },
              product: { select: { name: true } },
              access: { select: { productAccessId: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      listOwnedInquiries(req.user!.id),
    ]);
    const saleRows = customers.map((customer) => {
      const latest = customer.sales[0];
      return {
        id: customer.id,
        kind: "sale" as const,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        company: customer.company,
        phone: null as string | null,
        message: null as string | null,
        status: customer.status,
        hasAccount: Boolean(customer.userId),
        offer: latest?.offer.title ?? null,
        product: latest?.product?.name ?? null,
        saleStatus: latest ? (latest.status === "COMPLETED" ? "PAID" : latest.status) : null,
        accessStatus: latest?.accessProvisionedAt ? "ACTIVE" : latest ? "PENDING" : "NONE",
        purchasedAt: latest?.paidAt ?? latest?.createdAt ?? null,
      };
    });
    const inquiryRows = inquiries.map((row) => ({
      id: row.id,
      kind: "inquiry" as const,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      company: row.company,
      phone: row.phone,
      message: row.message,
      status: "INQUIRY",
      hasAccount: false,
      agency: row.profile?.product.name || row.profile?.title || null,
      offer: row.profile?.offer?.title ?? row.offer?.title ?? null,
      product: row.profile?.product.name ?? null,
      pageTitle: row.profile?.title ?? null,
      saleStatus: "Inquiry",
      accessStatus: "Email follow-up",
      purchasedAt: row.createdAt,
    }));
    res.json(
      ok([
        ...inquiryRows,
        ...saleRows.map((row) => ({
          ...row,
          agency: row.product,
          pageTitle: null as string | null,
        })),
      ])
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/checkout/:code", async (req: AuthRequest, res, next) => {
  try {
    const status = await getResellerCheckoutStatus(req.params.code, req.user!.id, req.user!.role);
    res.json(ok(status));
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/checkout/:code/cancel", async (req: AuthRequest, res, next) => {
  try {
    const status = await cancelResellerCheckout(req.params.code, req.user!.id);
    res.json(ok(status));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/sales", async (req: AuthRequest, res, next) => {
  try {
    const rights = await loadResellerRights(req.user!.id);
    if (!rights.length) {
      res.json(ok([]));
      return;
    }
    const sales = await listOwnedSales(req.user!.id, {
      status: String(req.query.status || ""),
      offerId: String(req.query.offerId || ""),
      q: String(req.query.q || ""),
      from: String(req.query.from || ""),
      to: String(req.query.to || ""),
    });
    res.json(
      ok(
        sales.map((sale) => ({
          ...sale,
          status: sale.status === "COMPLETED" ? "PAID" : sale.status,
        }))
      )
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/sales/:id", async (req: AuthRequest, res, next) => {
  try {
    const sale = await prisma.resellerSale.findFirst({
      where: { id: req.params.id, resellerUserId: req.user!.id },
      include: {
        offer: { select: { title: true, slug: true } },
        customer: { select: { email: true, firstName: true, lastName: true, company: true } },
        product: { select: { name: true, slug: true } },
        bundle: { select: { name: true, slug: true } },
        access: { select: { productAccessId: true, product: { select: { name: true, slug: true } } } },
      },
    });
    if (!sale) throw new AppError(404, "Sale not found", "NOT_FOUND");
    res.json(ok(sale));
  } catch (err) {
    next(err);
  }
});

resellerRouter.get("/customers/:id", async (req: AuthRequest, res, next) => {
  try {
    const customer = await prisma.resellerCustomer.findFirst({
      where: { id: req.params.id, resellerUserId: req.user!.id },
      include: {
        sales: {
          include: {
            offer: { select: { title: true } },
            product: { select: { name: true } },
            access: { select: { productAccessId: true, product: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!customer) {
      const inquiry = await prisma.resellerInquiry.findFirst({
        where: { id: req.params.id, resellerUserId: req.user!.id },
        include: {
          profile: { select: { title: true, product: { select: { name: true } }, offer: { select: { title: true } } } },
          offer: { select: { title: true } },
        },
      });
      if (!inquiry) throw new AppError(404, "Customer not found", "NOT_FOUND");
      res.json(
        ok({
          id: inquiry.id,
          kind: "inquiry",
          email: inquiry.email,
          firstName: inquiry.firstName,
          lastName: inquiry.lastName,
          company: inquiry.company,
          phone: inquiry.phone,
          message: inquiry.message,
          status: "INQUIRY",
          hasAccount: false,
          sales: [],
          inquiry: {
            agency: inquiry.profile?.product.name || inquiry.profile?.title || inquiry.offer?.title || "Inquiry",
            product: inquiry.profile?.product.name || null,
            offer: inquiry.profile?.offer?.title ?? inquiry.offer?.title ?? null,
            createdAt: inquiry.createdAt,
          },
        })
      );
      return;
    }
    res.json(
      ok({
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        company: customer.company,
        status: customer.status,
        hasAccount: Boolean(customer.userId),
        sales: customer.sales.map((sale) => ({
          id: sale.id,
          code: sale.code,
          status: sale.status === "COMPLETED" ? "PAID" : sale.status,
          amountCents: sale.amountCents,
          currency: sale.currency,
          createdAt: sale.createdAt,
          paidAt: sale.paidAt,
          offer: sale.offer.title,
          product: sale.product?.name || null,
          products: sale.access.map((row) => row.product?.name).filter(Boolean),
          accessStatus: sale.accessProvisionedAt ? "ACTIVE" : "PENDING",
        })),
      })
    );
  } catch (err) {
    next(err);
  }
});

resellerRouter.post("/sales", async (req: AuthRequest, res, next) => {
  try {
    await requireReseller(req.user!.id);
    const body = req.body ?? {};
    const offer = await prisma.resellerOffer.findFirst({
      where: { id: String(body.offerId || ""), resellerUserId: req.user!.id },
    });
    if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
    const result = await fulfillResellerSale({
      offerId: offer.id,
      resellerUserId: req.user!.id,
      actorUserId: req.user!.id,
      buyer: {
        email: String(body.email || ""),
        firstName: String(body.firstName || ""),
        lastName: String(body.lastName || ""),
        company: body.company ? String(body.company) : null,
        notes: body.notes ? String(body.notes) : null,
      },
      paymentStatus: "RECORDED",
      paymentNote: "Recorded by reseller. Product access granted. Reseller rights were not granted.",
    });
    res.status(201).json(ok(result));
  } catch (err) {
    next(err);
  }
});
