import { lookup } from "dns/promises";
import { isIP } from "net";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@aes/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";
import { buildAgencyOneHtml } from "../products/agency-one-export";
import { buildPremiumSalesPageHtml } from "../products/premium-sales-export";
import { loadResellerRights, readCoveredProductIds } from "./entitlements";
import { publicBrandFor, readOwnedAsset, whiteLabelAllowed } from "./branding";

export type AgencyInput = {
  id?: string | null;
  productId?: string | null;
  offerId?: string | null;
  title?: string | null;
  brandName?: string | null;
  logoPath?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  footerText?: string | null;
  wordpressUrl?: string | null;
  published?: boolean;
};

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function hex(value: unknown) {
  const color = clean(value, 16);
  if (!color) return null;
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw new AppError(400, "Colors must be hex values", "INVALID_BRAND");
  }
  return color;
}

function httpsUrl(value: unknown, label: string) {
  const url = clean(value, 300);
  if (!url) return null;
  if (!/^https:\/\/.+/i.test(url)) throw new AppError(400, `${label} must be an https URL`, "INVALID_URL");
  return url;
}

/** Only accept logo paths owned by this reseller under brand-assets. */
function ownedLogoPath(userId: string, value: unknown) {
  const path = clean(value, 300);
  if (!path) return null;
  const prefix = `/api/reseller/public/brand-assets/${userId}/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    throw new AppError(400, "Logo upload is invalid", "INVALID_UPLOAD");
  }
  if (!/^logo-[a-f0-9]{16}\.(png|jpg|webp|ico)$/.test(path.slice(prefix.length))) {
    throw new AppError(400, "Logo upload is invalid", "INVALID_UPLOAD");
  }
  return path;
}

function slugify(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agency";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

async function entitledProductIds(userId: string) {
  const rights = await loadResellerRights(userId);
  const ids = [...new Set(rights.flatMap((row) => row.products.map((product) => product.id)))];
  return { rights, ids };
}

export async function listAgencyChoices(userId: string) {
  const { rights, ids } = await entitledProductIds(userId);
  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];
  const offers = await prisma.resellerOffer.findMany({
    where: { resellerUserId: userId, status: { not: "ARCHIVED" } },
    select: { id: true, title: true, status: true, priceCents: true, currency: true },
    orderBy: { updatedAt: "desc" },
  });
  return {
    canWhiteLabel: rights.some((row) => row.policy?.allowBranding === true),
    products,
    offers,
  };
}

const profileInclude = {
  product: { select: { id: true, name: true, slug: true, shortDescription: true, description: true } },
  offer: { select: { id: true, title: true, slug: true, status: true, salesCopy: true, description: true, priceCents: true, currency: true, ctaText: true } },
  _count: { select: { inquiries: true } },
} as const;

export function serializeProfile(row: {
  id: string;
  slug: string;
  title: string;
  brandName: string | null;
  logoPath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  website: string | null;
  supportPhone: string | null;
  footerText: string | null;
  wordpressUrl: string | null;
  wordpressPageUrl: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: { id: string; name: string; slug: string };
  offer: { id: string; title: string; status: string } | null;
  _count?: { inquiries: number };
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    brandName: row.brandName,
    logoUrl: row.logoPath ? `${env.API_URL}${row.logoPath}` : null,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    supportEmail: row.supportEmail,
    website: row.website,
    supportPhone: row.supportPhone,
    footerText: row.footerText,
    wordpressUrl: row.wordpressUrl,
    wordpressPageUrl: row.wordpressPageUrl,
    published: row.published,
    publicPath: `/a/${row.slug}`,
    product: row.product,
    offer: row.offer,
    inquiries: row._count?.inquiries ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOwnedAgencies(userId: string, publishedOnly = false) {
  return prisma.resellerAgencyProfile.findMany({
    where: { userId, ...(publishedOnly ? { published: true } : {}) },
    include: profileInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function saveAgencyProfile(userId: string, input: AgencyInput) {
  const title = clean(input.title, 80);
  if (!title) throw new AppError(400, "Give this agency a title", "INVALID_TITLE");
  const { ids } = await entitledProductIds(userId);
  const productId = String(input.productId || "");
  if (!ids.includes(productId)) {
    throw new AppError(403, "You can only brand agencies you are entitled to resell", "RESELLER_SCOPE");
  }
  const product = await prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED" }, select: { id: true } });
  if (!product) throw new AppError(404, "Agency not found", "NOT_FOUND");

  let offerId: string | null = null;
  if (input.offerId) {
    const offer = await prisma.resellerOffer.findFirst({
      where: { id: String(input.offerId), resellerUserId: userId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
    offerId = offer.id;
  }

  const supportEmail = clean(input.supportEmail, 120);
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    throw new AppError(400, "Support email is invalid", "INVALID_BRAND");
  }
  const data = {
    productId,
    offerId,
    title,
    brandName: clean(input.brandName, 80),
    primaryColor: hex(input.primaryColor),
    secondaryColor: hex(input.secondaryColor),
    supportEmail,
    website: null,
    supportPhone: clean(input.supportPhone, 40),
    footerText: clean(input.footerText, 180),
    wordpressUrl: httpsUrl(input.wordpressUrl, "WordPress link"),
    published: Boolean(input.published),
    ...(input.logoPath !== undefined ? { logoPath: ownedLogoPath(userId, input.logoPath) } : {}),
  };

  if (input.id) {
    const existing = await prisma.resellerAgencyProfile.findFirst({ where: { id: input.id, userId } });
    if (!existing) throw new AppError(404, "Saved agency not found", "NOT_FOUND");
    return prisma.resellerAgencyProfile.update({
      where: { id: existing.id },
      data,
      include: profileInclude,
    });
  }

  return prisma.resellerAgencyProfile.create({
    data: { userId, slug: slugify(title), ...data },
    include: profileInclude,
  });
}

export async function deleteOwnedAgency(userId: string, id: string) {
  const existing = await prisma.resellerAgencyProfile.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new AppError(404, "Saved agency not found", "NOT_FOUND");
  await prisma.resellerAgencyProfile.delete({ where: { id } });
}

async function ownedProfile(userId: string, id: string, mode: "full" | "sales" | "agency" = "full") {
  const salesSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    shortDescription: true,
    tagline: true,
    configuration: true,
    resources: {
      where: { type: "SERVICE" as const, isPublished: true },
      select: { id: true, type: true, title: true },
      orderBy: { sortOrder: "asc" as const },
      take: 24,
    },
    workflows: {
      where: { isActive: true },
      select: { id: true },
      take: 500,
    },
  };

  const agencySelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    shortDescription: true,
    tagline: true,
    configuration: true,
    resources: {
      where: { type: "SERVICE" as const, isPublished: true },
      select: { id: true, type: true, title: true },
      orderBy: { sortOrder: "asc" as const },
    },
    workflows: {
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        purpose: true,
        serviceResourceId: true,
        aiInstructionTemplate: true,
        outputDefinition: true,
        nextAction: true,
      },
      orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    },
  };

  const fullSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    shortDescription: true,
    tagline: true,
    icon: true,
    configuration: true,
    resources: {
      where: { isPublished: true },
      select: {
        id: true,
        type: true,
        title: true,
        slug: true,
        description: true,
        content: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" as const },
    },
    workflows: {
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        purpose: true,
        serviceResourceId: true,
        displayOrder: true,
        inputs: true,
        aiInstructionTemplate: true,
        outputDefinition: true,
        reviewRequirements: true,
        nextAction: true,
      },
      orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    },
  };

  const productSelect = mode === "sales" ? salesSelect : mode === "agency" ? agencySelect : fullSelect;

  const row = await prisma.resellerAgencyProfile.findFirst({
    where: { id, userId },
    include: {
      ...profileInclude,
      product: { select: productSelect },
    },
  });
  if (!row) throw new AppError(404, "Saved agency not found", "NOT_FOUND");
  return row;
}

function mimeForExt(ext: string) {
  if (ext === "jpg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "ico") return "image/x-icon";
  return "image/png";
}

async function embedLogoDataUrl(userId: string, logoPath: string | null) {
  if (!logoPath) return null;
  const filename = path.basename(logoPath);
  try {
    const file = await readOwnedAsset(userId, filename);
    const bytes = await readFile(file);
    const ext = filename.split(".").pop()?.toLowerCase() || "png";
    return `data:${mimeForExt(ext)};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function agencyDownloadHtml(userId: string, id: string, kind: "sales" | "agency") {
  const row = await ownedProfile(userId, id, kind);
  // Lightweight entitlement check — avoid reloading all rights + covered products.
  const entitlements = await prisma.resellerEntitlement.findMany({
    where: { userId, status: "ACTIVE" },
    select: { productId: true, coveredProductIds: true, policySnapshot: true },
  });
  const entitled = entitlements.find(
    (item) =>
      item.productId === row.productId ||
      readCoveredProductIds(item.coveredProductIds).includes(row.productId)
  );
  if (!entitled) {
    throw new AppError(403, "This account is not entitled to export this agency", "NOT_ENTITLED");
  }

  // Sales HTML posts inquiries to the public API — publish so leads always land.
  if (kind === "sales" && !row.published) {
    await prisma.resellerAgencyProfile.update({
      where: { id: row.id },
      data: { published: true },
    });
    row.published = true;
  }

  const branded = await whiteLabelAllowed({ policySnapshot: entitled.policySnapshot });
  const globalBrand = branded ? await publicBrandFor(userId, true) : null;
  const accent =
    (branded && (row.primaryColor || globalBrand?.primaryColor)) ||
    (typeof row.product.configuration === "object" &&
    row.product.configuration &&
    typeof (row.product.configuration as Record<string, unknown>).accent === "string" &&
    String((row.product.configuration as Record<string, unknown>).accent).startsWith("#")
      ? String((row.product.configuration as Record<string, unknown>).accent)
      : "#2563EB");
  const brandName = branded
    ? row.brandName || globalBrand?.brandName || row.title || "AI Enterprise Studio"
    : "AI Enterprise Studio";
  const logoPath = branded
    ? row.logoPath || (globalBrand?.logoUrl ? globalBrand.logoUrl.replace(env.API_URL, "") : null)
    : null;
  const faviconPath = branded
    ? globalBrand?.faviconUrl
      ? globalBrand.faviconUrl.replace(env.API_URL, "").split("?")[0]
      : null
    : null;
  const [logoDataUrl, faviconDataUrl] = branded
    ? await Promise.all([embedLogoDataUrl(userId, logoPath), embedLogoDataUrl(userId, faviconPath)])
    : [null, null];
  const supportEmail = branded ? row.supportEmail || globalBrand?.supportEmail || null : null;
  const footerText = branded ? row.footerText || globalBrand?.footerText || null : null;
  const inquiryUrl = `${env.APP_URL}/a/${row.slug}`;

  const services = row.product.resources.filter((r) => r.type === "SERVICE");
  const offerTitle = row.offer?.title || null;
  const offerCopy = row.offer?.salesCopy || row.offer?.description || null;
  const offerCta = row.offer?.ctaText || null;
  const offerPriceCents = row.offer?.priceCents ?? null;
  const offerCurrency = row.offer?.currency || null;

  if (kind === "sales") {
    const html = buildPremiumSalesPageHtml({
      name: row.product.name,
      slug: row.product.slug,
      accent,
      services: services.map((s) => s.title),
      serviceCount: services.length,
      workflowCount: row.product.workflows.length,
      brandName: branded ? brandName : null,
      logoDataUrl,
      faviconDataUrl,
      inquiryUrl,
      supportEmail,
      footerText,
      offerTitle,
      offerCopy,
      offerCta,
      offerPriceCents,
      offerCurrency,
      inquireEndpoint: branded
        ? `${env.API_URL}/api/reseller/public/agencies/${row.slug}/inquiry`
        : `${env.API_URL}/api/sales/inquiries`,
      suiteUrl: `${env.APP_URL}/purchase?suite=1`,
    });
    return { filename: `${row.slug}-sales-page.html`, html };
  }

  const html = buildAgencyOneHtml({
    name: row.product.name,
    slug: row.product.slug,
    tagline: row.product.tagline,
    shortDescription: row.product.shortDescription,
    description: row.product.description,
    accent,
    brandName: branded ? brandName : null,
    logoDataUrl,
    faviconDataUrl,
    footerText,
    services: services.map((s) => ({ id: s.id, title: s.title })),
    workflows: row.product.workflows.map((w) => ({
      id: w.id,
      name: "name" in w ? String(w.name || "") : "",
      description: "description" in w ? (w.description as string | null) : null,
      purpose: "purpose" in w ? (w.purpose as string | null) : null,
      serviceResourceId: "serviceResourceId" in w ? (w.serviceResourceId as string | null) : null,
      aiInstructionTemplate: "aiInstructionTemplate" in w ? w.aiInstructionTemplate : null,
      outputDefinition: "outputDefinition" in w ? w.outputDefinition : null,
      nextAction: "nextAction" in w ? (w.nextAction as string | null) : null,
    })),
  });
  return { filename: `${row.product.slug}-agency.html`, html };
}

function isPrivateIp(ip: string) {
  const value = ip.toLowerCase();
  if (value === "::1" || value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("169.254.") || value.startsWith("0.")) return true;
  const match = /^172\.(\d+)\./.exec(value);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80");
}

async function assertPublicHttps(raw: string) {
  let url: URL;
  try {
    // Accept pasted admin/login URLs — we only need the site origin for REST.
    url = new URL(raw.trim());
  } catch {
    throw new AppError(400, "WordPress link must be a public https URL", "INVALID_URL");
  }
  if (url.protocol !== "https:") throw new AppError(400, "WordPress link must use https", "INVALID_URL");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new AppError(400, "WordPress link must be a public site", "INVALID_URL");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((row) => row.address);
  if (!addresses.length || addresses.some(isPrivateIp)) {
    throw new AppError(400, "WordPress link must be a public site", "INVALID_URL");
  }
  return new URL(url.origin);
}

function wordpressErrorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    if (typeof row.message === "string" && row.message.trim()) {
      return row.message.trim();
    }
    if (typeof row.code === "string" && row.code.trim()) {
      return `WordPress error: ${row.code}`;
    }
  }
  if (status === 401 || status === 403) {
    return "WordPress rejected the username or application password. Create an Application Password in WordPress → Users → Profile.";
  }
  if (status === 404) {
    return "WordPress REST API was not found. Check the site URL and that permalinks are not set to Plain.";
  }
  if (status >= 300 && status < 400) {
    return "WordPress redirected the publish request. Use the final https site URL (often with or without www).";
  }
  return `WordPress did not publish the page (HTTP ${status}).`;
}

/** Convert full AES sales HTML into a WordPress Custom HTML block (real sales page, not an iframe). */
function salesHtmlForWordPress(fullHtml: string, asHomepage: boolean): string {
  const styles = [...fullHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(fullHtml);
  let body = bodyMatch?.[1] || fullHtml;
  // Drop outer chrome that breaks inside a WP theme layout.
  body = body.replace(/<\/?(html|head|body)[^>]*>/gi, "");
  // Hide WordPress theme header/nav/footer so the sales page fills the domain.
  const chromeHide = `
html, body { margin: 0 !important; padding: 0 !important; background: #0b1220; }
.wp-site-blocks > header,
.wp-site-blocks > footer,
.site-header, .site-footer, .site-branding, .main-navigation,
#masthead, #colophon, #site-header, #site-navigation, #site-footer,
.wp-block-template-part, .entry-header, .entry-footer,
.page-header, .post-navigation, .nav-links, .breadcrumb,
#wpadminbar { display: none !important; }
#page, #content, .site, .site-content, .content-area, .entry-content,
.wp-site-blocks, .wp-block-post-content, .wp-block-group,
main, article, .hentry {
  margin: 0 !important;
  padding: 0 !important;
  max-width: none !important;
  width: 100% !important;
}
${asHomepage ? "body.home .entry-title, body.page .entry-title, h1.entry-title { display: none !important; }" : ""}
`;
  const styleTag = `<style>\n${chromeHide}\n${styles}\n</style>\n`;
  return `<!-- wp:html -->\n${styleTag}${body}\n<!-- /wp:html -->`;
}

function wordpressPageSlug(agencySlug: string, productSlug: string) {
  const raw = (agencySlug || productSlug || "sales-page")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return raw || "sales-page";
}

async function wordpressRequest(
  endpoint: URL,
  auth: string,
  method: "GET" | "POST" | "PUT",
  body?: Record<string, unknown>
) {
  try {
    return await fetch(endpoint, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "network error";
    throw new AppError(
      400,
      `Could not reach WordPress (${reason}). Check the https site URL and that the REST API is enabled.`,
      "WORDPRESS_UNREACHABLE"
    );
  }
}

type WpPagePayload = {
  id?: number;
  link?: string;
  message?: string;
  code?: string;
  guid?: { rendered?: string };
};

async function readWpPayload(response: Response): Promise<WpPagePayload | WpPagePayload[] | null> {
  const rawText = await response.text();
  try {
    return rawText ? (JSON.parse(rawText) as WpPagePayload | WpPagePayload[]) : null;
  } catch {
    return null;
  }
}

async function setWordPressHomepage(site: URL, auth: string, pageId: number) {
  const settingsUrl = new URL("/wp-json/wp/v2/settings", site.origin);
  const response = await wordpressRequest(settingsUrl, auth, "POST", {
    show_on_front: "page",
    page_on_front: pageId,
  });
  if (!response.ok) {
    const payload = await readWpPayload(response);
    throw new AppError(
      400,
      wordpressErrorMessage(response.status, payload) ||
        "Sales page was created, but WordPress did not allow setting it as the homepage. Use an Administrator account.",
      "WORDPRESS_HOMEPAGE",
      { status: response.status }
    );
  }
}

export async function publishAgencyToWordPress(
  userId: string,
  id: string,
  input: {
    siteUrl?: string;
    username?: string;
    appPassword?: string;
    /** When true, set this sales page as the WordPress site homepage (domain root). */
    asHomepage?: boolean;
  }
) {
  const row = await ownedProfile(userId, id, "sales");
  const site = await assertPublicHttps(String(input.siteUrl || row.wordpressUrl || ""));
  const username = clean(input.username, 80);
  // Application passwords are often copied with spaces — WordPress ignores whitespace.
  const appPassword = clean(input.appPassword, 120)?.replace(/\s+/g, "") || null;
  const asHomepage = input.asHomepage !== false; // default: deploy on domain root
  if (!username || !appPassword) {
    throw new AppError(
      400,
      "WordPress username and application password are required to publish",
      "WORDPRESS_AUTH"
    );
  }

  if (!row.published) {
    await prisma.resellerAgencyProfile.update({
      where: { id: row.id },
      data: { published: true },
    });
    row.published = true;
  }

  // Build the real branded sales page HTML (same as Download sales page).
  const downloaded = await agencyDownloadHtml(userId, id, "sales");
  const content = salesHtmlForWordPress(downloaded.html, asHomepage);
  const slug = wordpressPageSlug(row.slug, row.product.slug);
  const pageTitle = `${row.product.name} Sales Page`;
  const auth = Buffer.from(`${username}:${appPassword}`, "utf8").toString("base64");

  // Reuse existing WP page with this slug when possible (avoids random title-based URLs).
  const listUrl = new URL("/wp-json/wp/v2/pages", site.origin);
  listUrl.searchParams.set("slug", slug);
  listUrl.searchParams.set("status", "any");
  const existingRes = await wordpressRequest(listUrl, auth, "GET");
  const existingPayload = await readWpPayload(existingRes);
  const existingPage = Array.isArray(existingPayload) ? existingPayload[0] : null;

  const pageBody = {
    title: pageTitle,
    slug,
    status: "publish",
    content,
  };

  const response = existingPage?.id
    ? await wordpressRequest(new URL(`/wp-json/wp/v2/pages/${existingPage.id}`, site.origin), auth, "PUT", pageBody)
    : await wordpressRequest(new URL("/wp-json/wp/v2/pages", site.origin), auth, "POST", pageBody);

  const payload = (await readWpPayload(response)) as WpPagePayload | null;
  const pageId = payload?.id ?? existingPage?.id ?? null;
  let pageLink =
    (payload?.link && String(payload.link)) ||
    (payload?.guid?.rendered && String(payload.guid.rendered)) ||
    (pageId ? `${site.origin}/?page_id=${pageId}` : null) ||
    `${site.origin}/${slug}/`;

  if (!response.ok || !pageLink) {
    throw new AppError(400, wordpressErrorMessage(response.status, payload), "WORDPRESS_REJECTED", {
      status: response.status,
      code: payload?.code ?? null,
    });
  }

  if (asHomepage && pageId) {
    await setWordPressHomepage(site, auth, pageId);
    pageLink = `${site.origin}/`;
  }

  const saved = await prisma.resellerAgencyProfile.update({
    where: { id: row.id },
    data: { wordpressUrl: site.origin, wordpressPageUrl: pageLink, published: true },
    include: profileInclude,
  });
  return saved;
}

export async function publicAgencyPage(slug: string) {
  const row = await prisma.resellerAgencyProfile.findFirst({
    where: { slug, published: true },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          description: true,
          resources: { where: { type: "SERVICE", isPublished: true }, select: { title: true }, take: 12 },
        },
      },
      offer: {
        select: {
          title: true,
          salesCopy: true,
          description: true,
          ctaText: true,
          priceCents: true,
          currency: true,
        },
      },
    },
  });
  if (!row) throw new AppError(404, "This sales page is not published", "NOT_FOUND");
  const rights = await loadResellerRights(row.userId);
  const covered = rights.find((item) => item.products.some((product) => product.id === row.product.id));
  if (!covered) throw new AppError(404, "This sales page is not published", "NOT_FOUND");
  const allowed = covered.policy ? await whiteLabelAllowed({ policySnapshot: covered.policy }) : false;
  const brand = await publicBrandFor(row.userId, allowed);
  const showBrand = allowed && (row.brandName || row.primaryColor || brand);
  const brandLabel = showBrand ? row.brandName || brand?.brandName || null : null;
  return {
    slug: row.slug,
    title: row.title,
    brandName: brandLabel,
    logoUrl: showBrand ? (row.logoPath ? `${env.API_URL}${row.logoPath}` : brand?.logoUrl || null) : null,
    accent: showBrand ? row.primaryColor || brand?.primaryColor || "#c8f04d" : "#c8f04d",
    supportEmail: row.supportEmail || brand?.supportEmail || null,
    website: row.website || brand?.website || null,
    footerText: row.footerText || brand?.footerText || null,
    agency: row.product.name,
    summary: row.product.shortDescription || row.product.description,
    services: row.product.resources.map((item) => item.title),
    offer: row.offer
      ? {
          title: row.offer.title,
          copy: row.offer.salesCopy || row.offer.description,
          ctaText: row.offer.ctaText || "Request a conversation",
          priceCents: row.offer.priceCents,
          currency: row.offer.currency,
        }
      : null,
    attribution: brandLabel
      ? `Presented by ${brandLabel}.`
      : "Access is provided through AI Enterprise Studio.",
  };
}

export async function createAgencyInquiry(
  slug: string,
  input: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string; message?: string }
) {
  const profile = await prisma.resellerAgencyProfile.findFirst({
    where: { slug },
    select: {
      id: true,
      userId: true,
      title: true,
      supportEmail: true,
      brandName: true,
      published: true,
      product: { select: { name: true } },
    },
  });
  if (!profile) throw new AppError(404, "Sales page not found", "NOT_FOUND");
  const firstName = clean(input.firstName, 60);
  const lastName = clean(input.lastName, 60);
  const email = clean(input.email, 120)?.toLowerCase() || null;
  if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Name and a valid email are required", "INVALID_INQUIRY");
  }
  const row = await prisma.resellerInquiry.create({
    data: {
      resellerUserId: profile.userId,
      profileId: profile.id,
      firstName,
      lastName,
      email,
      phone: clean(input.phone, 40),
      company: clean(input.company, 80),
      message: clean(input.message, 1000),
    },
  });

  // Keep the page discoverable once it starts receiving leads.
  if (!profile.published) {
    await prisma.resellerAgencyProfile.update({
      where: { id: profile.id },
      data: { published: true },
    });
  }

  const branding = await prisma.resellerBranding.findUnique({
    where: { userId: profile.userId },
    select: { supportEmail: true, brandName: true },
  });
  const owner = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { email: true },
  });
  const notifyTo = profile.supportEmail || branding?.supportEmail || owner?.email || null;
  if (notifyTo) {
    const { sendNotification } = await import("../email/notifications");
    await sendNotification({
      type: "reseller_inquiry",
      to: notifyTo,
      data: {
        interest:
          profile.brandName || branding?.brandName || profile.title || profile.product.name,
        firstName,
        lastName,
        email,
        phone: row.phone,
        company: row.company,
        message: row.message,
      },
    });
  }

  const { createAppNotification } = await import("../notifications/notify");
  const agencyName = profile.product.name || profile.title;
  await createAppNotification({
    userId: profile.userId,
    type: "reseller_inquiry",
    title: `New enquiry: ${agencyName}`,
    body: `${firstName} ${lastName} (${email}) requested this agency.`,
    href: "/reseller/customers",
    entityType: "ResellerInquiry",
    entityId: row.id,
  });

  return row;
}

export async function listOwnedInquiries(userId: string) {
  return prisma.resellerInquiry.findMany({
    where: { resellerUserId: userId },
    include: {
      profile: { select: { title: true, product: { select: { name: true } }, offer: { select: { title: true } } } },
      offer: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
