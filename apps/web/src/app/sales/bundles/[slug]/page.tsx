import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BundleSalesView } from "@/components/sales/BundleSalesView";
import { fetchSalesCatalog } from "@/lib/sales/catalog";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const catalog = await fetchSalesCatalog();
    const bundle =
      catalog.bundles.find((b) => b.slug === slug) ||
      (slug === "complete-suite" || slug === catalog.suite.slug ? catalog.suite : null);
    if (!bundle) return { title: "Bundle" };
    return {
      title: `${bundle.name} — Bundle`,
      description: bundle.shortDescription || bundle.tagline,
      alternates: { canonical: `/sales/bundles/${bundle.slug}` },
    };
  } catch {
    return { title: "Bundle" };
  }
}

export default async function BundleSalesPage({ params }: Props) {
  const { slug } = await params;
  try {
    const catalog = await fetchSalesCatalog();
    const bundle =
      catalog.bundles.find((b) => b.slug === slug) ||
      (slug === "complete-suite" || slug === catalog.suite.slug ? catalog.suite : null);
    if (!bundle) notFound();
    return (
      <BundleSalesView
        bundle={bundle}
        agencies={catalog.agencies}
        allBundles={catalog.bundles}
      />
    );
  } catch {
    notFound();
  }
}
