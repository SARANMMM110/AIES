"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import type { CatalogAgency, CatalogBundle } from "@/lib/sales/catalog";
import { formatMoney } from "@/lib/purchase";
import { CatalogAgencyCard } from "./CatalogAgencyCard";
import { SalesInquiryForm } from "./SalesInquiryForm";
import { InquireSection } from "./InquireSection";
import { SalesFooter, SalesHeader } from "./SalesChrome";
import { SalesResaleSection } from "./SalesResaleSection";
import { ScrollToPurchase } from "./ScrollToPurchase";
import "./purchase-flow.css";
import "./catalog-sales.css";
import "./inquiry-form.css";

type Props = {
  bundle: CatalogBundle;
  agencies: CatalogAgency[];
  allBundles?: CatalogBundle[];
};

export function BundleSalesView({ bundle, agencies }: Props) {
  const products =
    bundle.products ??
    agencies.filter((a) => (bundle.productSlugs ?? []).includes(a.slug));

  return (
    <div
      className="sales-root catalog-page"
      style={
        {
          ["--sales-accent"]: "#caff45",
          ["--green"]: "#caff45",
          ["--sales-accent-ink"]: "#14200c",
        } as CSSProperties
      }
    >
      <SalesHeader />

      <main>
        <section className="catalog-hero" aria-labelledby="bundle-hero-title">
          <div className="container catalog-hero-inner">
            <p className="catalog-kicker">
              {bundle.isCompleteSuite ? "Complete Platform" : "Agency Bundle"}
            </p>
            <h1 id="bundle-hero-title">
              {bundle.name}
              <span> {bundle.tagline}</span>
            </h1>
            <p className="catalog-hero-lead">
              {bundle.description ||
                bundle.shortDescription ||
                `${bundle.agencyCount} agencies, ${bundle.serviceCount} services, and ${bundle.workflowCount} guided workflows in one pack.`}
            </p>
            <div className="catalog-hero-actions">
              <ScrollToPurchase className="btn lime">
                Purchase this pack →
              </ScrollToPurchase>
              <Link className="btn outline catalog-hero-outline" href="/sales">
                Browse catalog
              </Link>
            </div>
          </div>
        </section>

        <section className="catalog-section" id="included">
          <div className="container">
            <header className="catalog-section-head">
              <div>
                <p className="catalog-kicker soft">Included</p>
                <h2>Agencies in this pack</h2>
              </div>
              <p>
                Individual value {formatMoney(bundle.individualValueCents ?? null, bundle.currency)}
                {bundle.savingsCents
                  ? ` · Bundle ${formatMoney(bundle.priceCents, bundle.currency)} · Save ${formatMoney(bundle.savingsCents, bundle.currency)}`
                  : ` · Bundle ${formatMoney(bundle.priceCents, bundle.currency)}`}
              </p>
            </header>
            <div className="catalog-agency-grid">
              {products.map((product, index) => (
                <CatalogAgencyCard
                  key={product.slug}
                  agency={product}
                  index={index}
                  showPrice={false}
                />
              ))}
            </div>
          </div>
        </section>

        <SalesResaleSection />

        <InquireSection
          title={
            <>
              Tell us what you need.
              <span> We will unlock access.</span>
            </>
          }
          description={`Share your details to purchase ${bundle.name}. No payment is collected on this page.`}
          bullets={[
            "Response by email from the AES team",
            "Guidance on this pack and included agencies",
            "Access unlocked after admin follow-up",
          ]}
        >
          <SalesInquiryForm
            variant="dark"
            bundleSlug={bundle.slug}
            interest={bundle.name}
            ctaLabel="Send purchase details"
            showNote
          />
        </InquireSection>
      </main>

      <SalesFooter />
    </div>
  );
}
