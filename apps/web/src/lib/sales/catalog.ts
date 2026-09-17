import { cache } from "react";

export type CatalogAgency = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  shortDescription: string | null;
  description: string | null;
  category: string;
  icon: string | null;
  accent: string;
  sortOrder: number;
  serviceCount: number;
  workflowCount: number;
  services: string[];
  priceCents: number | null;
  currency: string;
};

export type CatalogBundleProduct = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  shortDescription: string | null;
  priceCents: number | null;
  currency: string;
  serviceCount: number;
  workflowCount: number;
  accent: string;
  category: string;
};

export type CatalogBundle = {
  id: string | null;
  name: string;
  slug: string;
  tagline: string;
  shortDescription?: string | null;
  description?: string | null;
  status?: string;
  priceCents: number | null;
  currency: string;
  icon?: string | null;
  thumbnailUrl?: string | null;
  displayOrder?: number;
  agencyCount: number;
  serviceCount: number;
  workflowCount: number;
  productSlugs?: string[];
  products?: CatalogBundleProduct[];
  individualValueCents?: number;
  savingsCents?: number;
  isCompleteSuite?: boolean;
};

/** @deprecated prefer CatalogBundle — Complete Suite is one published bundle */
export type CatalogSuite = CatalogBundle;

export type CatalogPayload = {
  agencies: CatalogAgency[];
  bundles: CatalogBundle[];
  suite: CatalogSuite;
  totals: { products: number; services: number; workflows: number; bundles?: number };
};

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { message: string } };

/** Public catalog can be cached briefly — cuts SSR latency between navigations. */
const CATALOG_REVALIDATE_SECONDS = 60;

export function getApiBase(): string {
  if (typeof window === "undefined") {
    return (
      process.env.API_INTERNAL_URL ||
      process.env.API_URL ||
      "http://127.0.0.1:4000"
    );
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

async function fetchCatalogJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
  const text = await res.text();
  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(
      `Catalog API returned non-JSON (${res.status}) from ${getApiBase()}${path}`
    );
  }
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error.message : "Failed to load catalog");
  }
  return json.data;
}

/** Deduped within a single RSC request (metadata + page share one fetch). */
export const fetchSalesCatalog = cache(async (): Promise<CatalogPayload> => {
  const data = await fetchCatalogJson<CatalogPayload>("/api/catalog");
  return {
    ...data,
    bundles: data.bundles ?? (data.suite ? [data.suite] : []),
  };
});

export const fetchAgencyCatalog = cache(async (slug: string): Promise<CatalogAgency> => {
  const data = await fetchCatalogJson<{ type: string; agency: CatalogAgency }>(
    `/api/catalog/${encodeURIComponent(slug)}`
  );
  if (data.type !== "agency") throw new Error("Agency not found");
  return data.agency;
});

export const fetchBundleCatalog = cache(async (
  slug: string
): Promise<{ bundle: CatalogBundle; agencies: CatalogAgency[] }> => {
  const data = await fetchCatalogJson<{
    type: string;
    bundle?: CatalogBundle;
    suite?: CatalogBundle;
    agencies: CatalogAgency[];
  }>(`/api/catalog/${encodeURIComponent(slug)}`);
  if (data.type === "suite" && data.suite) {
    return { bundle: data.suite, agencies: data.agencies };
  }
  if (data.type === "bundle" && data.bundle) {
    return { bundle: data.bundle, agencies: data.agencies };
  }
  throw new Error("Bundle not found");
});

export const AGENCY_SLUGS = [
  "ai-advantage-agency",
  "booking-flow-agency",
  "demand-builder-agency",
  "local-alliance-agency",
  "local-presence-agency",
  "referral-loop-agency",
  "repeat-revenue-agency",
  "revenue-revival-agency",
  "trust-builder-agency",
  "video-authority-agency",
] as const;

export const COMPLETE_SUITE_SLUG = "ai-enterprise-studio-complete-suite";
