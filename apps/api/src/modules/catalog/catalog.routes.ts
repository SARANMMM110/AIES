import { Router } from "express";
import { prisma } from "@aes/database";
import { APPROVED_PRODUCT_SLUGS } from "../../constants/product-scope";
import { ok } from "../../utils/response";
import { AppError } from "../../utils/errors";

/**
 * Public marketing catalog — read-only, no auth.
 */
export const catalogRouter = Router();

export const COMPLETE_SUITE_SLUG = "ai-enterprise-studio-complete-suite";

type ProductConfig = {
  category?: string;
  accent?: string;
  sortOrder?: number;
  serviceCount?: number;
};

async function loadPublishedAgencies() {
  const products = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      slug: { in: [...APPROVED_PRODUCT_SLUGS] },
    },
    include: {
      resources: {
        where: { type: "SERVICE", isPublished: true },
        orderBy: { sortOrder: "asc" },
        select: { title: true, slug: true, sortOrder: true },
      },
      _count: { select: { workflows: true } },
    },
  });

  return products
    .map((p) => {
      const cfg = (p.configuration || {}) as ProductConfig;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        tagline: p.tagline,
        shortDescription: p.shortDescription,
        description: p.description,
        category: cfg.category || "Agency",
        icon: p.icon,
        accent: cfg.accent || "#2F6FED",
        sortOrder: cfg.sortOrder ?? 99,
        serviceCount: p.resources.length,
        workflowCount: p._count.workflows,
        services: p.resources.map((r) => r.title),
        priceCents: p.priceCents,
        currency: p.currency,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapBundlePublic(
  bundle: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortDescription: string | null;
    status: string;
    priceCents: number | null;
    currency: string;
    icon: string | null;
    thumbnailUrl: string | null;
    displayOrder: number;
    items: Array<{
      product: {
        id: string;
        name: string;
        slug: string;
        priceCents: number | null;
        currency: string;
        icon: string | null;
        shortDescription: string | null;
        status: string;
        resources: Array<{ title: string }>;
        _count: { workflows: number };
      };
    }>;
  },
  agencyBySlug: Map<string, Awaited<ReturnType<typeof loadPublishedAgencies>>[number]>
) {
  const products = bundle.items
    .map((i) => {
      const fromCatalog = agencyBySlug.get(i.product.slug);
      return {
        id: i.product.id,
        name: i.product.name,
        slug: i.product.slug,
        icon: i.product.icon,
        shortDescription: i.product.shortDescription,
        priceCents: i.product.priceCents,
        currency: i.product.currency,
        serviceCount: fromCatalog?.serviceCount ?? i.product.resources.length,
        workflowCount: fromCatalog?.workflowCount ?? i.product._count.workflows,
        accent: fromCatalog?.accent ?? "#2F6FED",
        category: fromCatalog?.category ?? "Agency",
      };
    })
    .filter((p) => agencyBySlug.has(p.slug) || true);

  const serviceCount = products.reduce((n, p) => n + p.serviceCount, 0);
  const workflowCount = products.reduce((n, p) => n + p.workflowCount, 0);
  const individualValueCents = products.reduce((n, p) => n + (p.priceCents ?? 0), 0);
  const savingsCents =
    bundle.priceCents != null && individualValueCents > bundle.priceCents
      ? individualValueCents - bundle.priceCents
      : 0;

  return {
    id: bundle.id,
    name: bundle.name,
    slug: bundle.slug,
    tagline:
      bundle.slug === COMPLETE_SUITE_SLUG
        ? "10 AI agencies. One complete platform."
        : bundle.shortDescription || `${products.length} agencies in one pack`,
    shortDescription: bundle.shortDescription,
    description: bundle.description,
    status: bundle.status,
    priceCents: bundle.priceCents,
    currency: bundle.currency,
    icon: bundle.icon,
    thumbnailUrl: bundle.thumbnailUrl,
    displayOrder: bundle.displayOrder,
    agencyCount: products.length,
    serviceCount,
    workflowCount,
    productSlugs: products.map((p) => p.slug),
    products,
    individualValueCents,
    savingsCents,
    isCompleteSuite: bundle.slug === COMPLETE_SUITE_SLUG,
  };
}

async function loadActiveBundles(
  agencies: Awaited<ReturnType<typeof loadPublishedAgencies>>
) {
  const agencyBySlug = new Map(agencies.map((a) => [a.slug, a]));
  const bundles = await prisma.bundle.findMany({
    where: { status: "ACTIVE" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: {
              resources: {
                where: { type: "SERVICE", isPublished: true },
                select: { title: true },
              },
              _count: { select: { workflows: true } },
            },
          },
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  return bundles.map((b) => mapBundlePublic(b, agencyBySlug));
}

type AgencyRow = Awaited<ReturnType<typeof loadPublishedAgencies>>[number];
type BundleRow = Awaited<ReturnType<typeof loadActiveBundles>>[number];

let catalogCache: {
  at: number;
  agencies: AgencyRow[];
  bundles: BundleRow[];
  body: ReturnType<typeof ok>;
} | null = null;
const CATALOG_TTL_MS = 60_000;

async function buildCatalogPayload() {
  const agencies = await loadPublishedAgencies();
  const serviceCount = agencies.reduce((n, a) => n + a.serviceCount, 0);
  const workflowCount = agencies.reduce((n, a) => n + a.workflowCount, 0);
  const bundles = await loadActiveBundles(agencies);
  const suite =
    bundles.find((b) => b.slug === COMPLETE_SUITE_SLUG) ??
    ({
      id: "",
      name: "AI Enterprise Studio Complete Suite",
      slug: COMPLETE_SUITE_SLUG,
      tagline: "10 AI agencies. One complete platform.",
      description: null,
      shortDescription: null,
      status: "ACTIVE",
      priceCents: null,
      currency: "USD",
      icon: null,
      thumbnailUrl: null,
      displayOrder: 0,
      agencyCount: agencies.length,
      serviceCount,
      workflowCount,
      productSlugs: agencies.map((a) => a.slug),
      products: agencies.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        icon: a.icon,
        shortDescription: a.shortDescription,
        priceCents: a.priceCents,
        currency: a.currency,
        serviceCount: a.serviceCount,
        workflowCount: a.workflowCount,
        accent: a.accent,
        category: a.category,
      })),
      individualValueCents: agencies.reduce((n, a) => n + (a.priceCents ?? 0), 0),
      savingsCents: 0,
      isCompleteSuite: true,
    } satisfies BundleRow);

  const body = ok({
    agencies,
    bundles,
    suite,
    totals: {
      products: agencies.length,
      services: serviceCount,
      workflows: workflowCount,
      bundles: bundles.length,
    },
  });
  return { agencies, bundles, body };
}

catalogRouter.get("/", async (_req, res, next) => {
  try {
    const now = Date.now();
    if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      res.json(catalogCache.body);
      return;
    }
    const built = await buildCatalogPayload();
    catalogCache = { at: now, ...built };
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json(built.body);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/:slug", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const now = Date.now();
    let agencies: AgencyRow[];
    let bundles: BundleRow[];
    if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) {
      agencies = catalogCache.agencies;
      bundles = catalogCache.bundles;
    } else {
      const built = await buildCatalogPayload();
      catalogCache = { at: now, ...built };
      agencies = built.agencies;
      bundles = built.bundles;
    }

    if (slug === COMPLETE_SUITE_SLUG || slug === "complete-suite") {
      const suite = bundles.find((b) => b.slug === COMPLETE_SUITE_SLUG);
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      res.json(ok({ type: "suite" as const, suite, agencies, bundles }));
      return;
    }

    const bundle = bundles.find((b) => b.slug === slug);
    if (bundle) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
      res.json(ok({ type: "bundle" as const, bundle, agencies }));
      return;
    }

    const agency = agencies.find((a) => a.slug === slug);
    if (!agency) throw new AppError(404, "Catalog item not found", "NOT_FOUND");
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
    res.json(ok({ type: "agency" as const, agency }));
  } catch (err) {
    next(err);
  }
});
