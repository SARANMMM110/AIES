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

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export async function fetchSalesCatalog(init?: RequestInit): Promise<CatalogPayload> {
  const res = await fetch(`${getApiBase()}/api/catalog`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<CatalogPayload>;
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error.message : "Failed to load catalog");
  }
  return {
    ...json.data,
    bundles: json.data.bundles ?? (json.data.suite ? [json.data.suite] : []),
  };
}

export async function fetchAgencyCatalog(slug: string): Promise<CatalogAgency> {
  const res = await fetch(`${getApiBase()}/api/catalog/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const json = (await res.json()) as ApiEnvelope<{ type: string; agency: CatalogAgency }>;
  if (!res.ok || !json.success || json.data.type !== "agency") {
    throw new Error(!json.success ? json.error.message : "Agency not found");
  }
  return json.data.agency;
}

export async function fetchBundleCatalog(slug: string): Promise<{
  bundle: CatalogBundle;
  agencies: CatalogAgency[];
}> {
  const res = await fetch(`${getApiBase()}/api/catalog/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const json = (await res.json()) as ApiEnvelope<{
    type: string;
    bundle?: CatalogBundle;
    suite?: CatalogBundle;
    agencies: CatalogAgency[];
  }>;
  if (!res.ok || !json.success) {
    throw new Error(!json.success ? json.error.message : "Bundle not found");
  }
  if (json.data.type === "suite" && json.data.suite) {
    return { bundle: json.data.suite, agencies: json.data.agencies };
  }
  if (json.data.type === "bundle" && json.data.bundle) {
    return { bundle: json.data.bundle, agencies: json.data.agencies };
  }
  throw new Error("Bundle not found");
}

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
