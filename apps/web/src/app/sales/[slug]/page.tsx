import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgencySalesView } from "@/components/sales/AgencySalesView";
import { AGENCY_SLUGS, fetchSalesCatalog } from "@/lib/sales/catalog";
import { getAgencySalesCopy } from "@/lib/sales/agency-sales-content";

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string; frame?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const catalog = await fetchSalesCatalog();
    const agency = catalog.agencies.find((a) => a.slug === slug);
    if (!agency) return { title: "Agency Sales" };
    const copy = getAgencySalesCopy(slug);
    const title = `${agency.name} — Sales`;
    const description =
      copy?.subheadline?.slice(0, 155) ||
      agency.shortDescription ||
      `Request access to ${agency.name} from AI Enterprise Studio. No payment on this page.`;
    return {
      title,
      description,
      openGraph: {
        title: agency.name,
        description,
        url: `/sales/${slug}`,
        type: "website",
      },
      alternates: { canonical: `/sales/${slug}` },
    };
  } catch {
    return { title: "Agency Sales" };
  }
}

export default async function AgencySalesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { embed, frame } = await searchParams;
  if (!(AGENCY_SLUGS as readonly string[]).includes(slug)) notFound();

  const catalog = await fetchSalesCatalog().catch(() => null);
  if (!catalog) notFound();
  const agency = catalog.agencies.find((a) => a.slug === slug);
  if (!agency) notFound();

  return (
    <AgencySalesView
      agency={agency}
      agencies={catalog.agencies}
      suite={catalog.suite}
      embed={embed === "1"}
      framed={frame === "1"}
    />
  );
}
