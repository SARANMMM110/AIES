"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import { agencySalesImage } from "@/lib/sales/agency-images";
import { formatMoney } from "@/lib/purchase";

type AgencyCardData = {
  name: string;
  slug: string;
  accent?: string | null;
  icon?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
  category?: string | null;
  serviceCount: number;
  workflowCount: number;
  priceCents?: number | null;
  currency?: string;
};

function shortAgencyName(name: string) {
  return name.replace(/\s+Agency$/i, "");
}

export function CatalogAgencyCard({
  agency,
  index = 0,
  showPrice = true,
  showCategory = false,
}: {
  agency: AgencyCardData;
  index?: number;
  showPrice?: boolean;
  showCategory?: boolean;
}) {
  const image = agencySalesImage(agency.slug);
  const blurb =
    agency.shortDescription ||
    agency.tagline ||
    `${shortAgencyName(agency.name)} helps operators deliver structured work with guided workflows.`;

  const metaParts = [
    showCategory && agency.category ? agency.category : null,
    `${agency.serviceCount} services`,
    `${agency.workflowCount} workflows`,
    showPrice ? formatMoney(agency.priceCents ?? null, agency.currency ?? "USD") : null,
  ].filter(Boolean);

  return (
    <article
      className="catalog-agency-card"
      style={
        {
          ["--sales-accent"]: agency.accent || "#caff45",
          ["--card-delay"]: `${Math.min(index, 8) * 40}ms`,
        } as CSSProperties
      }
    >
      <Link
        href={`/sales/${agency.slug}`}
        className="catalog-agency-media"
        aria-label={`View ${agency.name}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`${shortAgencyName(agency.name)} agency preview`}
            width={960}
            height={720}
          />
        ) : (
          <div className="catalog-agency-fallback">
            <span>{agency.icon ?? shortAgencyName(agency.name).charAt(0)}</span>
            <strong>{shortAgencyName(agency.name)}</strong>
          </div>
        )}
      </Link>

      <div className="catalog-agency-body">
        <div className="catalog-agency-copy">
          <h3>{agency.name}</h3>
          <p className="catalog-agency-meta">{metaParts.join(" · ")}</p>
          <p className="catalog-agency-blurb">{blurb}</p>
        </div>
        <Link className="btn lime catalog-agency-cta" href={`/sales/${agency.slug}`}>
          View Agency →
        </Link>
      </div>
    </article>
  );
}
