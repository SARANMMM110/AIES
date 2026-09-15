import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BundleSalesView } from "@/components/sales/BundleSalesView";
import { fetchBundleCatalog, fetchSalesCatalog } from "@/lib/sales/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { bundle } = await fetchBundleCatalog(slug);
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
    const [{ bundle, agencies }, catalog] = await Promise.all([
      fetchBundleCatalog(slug),
      fetchSalesCatalog(),
    ]);
    return (
      <BundleSalesView bundle={bundle} agencies={agencies} allBundles={catalog.bundles} />
    );
  } catch {
    notFound();
  }
}
