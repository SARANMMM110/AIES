import type { Metadata } from "next";
import { SalesCatalogView } from "@/components/sales/SalesCatalogView";
import { fetchSalesCatalog } from "@/lib/sales/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Catalog — Agencies & Bundles",
  description:
    "Buy AI Enterprise Studio agencies individually or choose published bundles. 10 agencies, 99 services, 306 workflows.",
  openGraph: {
    title: "AI Enterprise Studio Sales Catalog",
    description: "Individual agencies and admin-defined bundles.",
    url: "/sales",
    type: "website",
  },
  alternates: { canonical: "/sales" },
};

export default async function SalesCatalogPage() {
  try {
    const catalog = await fetchSalesCatalog();
    return (
      <SalesCatalogView
        agencies={catalog.agencies}
        bundles={catalog.bundles}
        suite={catalog.suite}
        totals={catalog.totals}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load catalog";
    return (
      <main style={{ padding: "3rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
        <h1>Sales catalog unavailable</h1>
        <p>{message}</p>
        <p>Check that the API is running on port 4000 and DATABASE_URL is set.</p>
      </main>
    );
  }
}
