"use client";

import { type CSSProperties } from "react";
import type { CatalogAgency, CatalogSuite } from "@/lib/sales/catalog";
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
  agencies: CatalogAgency[];
  suite: CatalogSuite;
  totals: { products: number; services: number; workflows: number };
};

export function SuiteSalesView({ agencies, suite, totals }: Props) {
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
        <section className="catalog-hero" aria-labelledby="suite-hero-title">
          <div className="container catalog-hero-inner">
            <p className="catalog-kicker">Complete Platform</p>
            <h1 id="suite-hero-title">
              10 AI agencies.
              <span> One complete platform.</span>
            </h1>
            <p className="catalog-hero-lead">
              The Complete Suite brings together {totals.products} specialized agencies,{" "}
              {totals.services} services, and {totals.workflows} guided workflows — with human
              review built into every delivery path.
            </p>
            <div className="catalog-hero-actions">
              <ScrollToPurchase className="btn lime">
                Purchase the suite →
              </ScrollToPurchase>
              <a className="btn outline catalog-hero-outline" href="#services">
                Compare agencies
              </a>
            </div>
          </div>
        </section>

        <section className="catalog-section" id="services">
          <div className="container">
            <header className="catalog-section-head">
              <div>
                <p className="catalog-kicker soft">Products</p>
                <h2>
                  All {agencies.length} agencies.
                  <br />
                  One studio.
                </h2>
              </div>
              <p>Each card reflects live catalog data — names, categories, services, and workflow counts.</p>
            </header>
            <div className="catalog-agency-grid">
              {agencies.map((agency, index) => (
                <CatalogAgencyCard
                  key={agency.slug}
                  agency={agency}
                  index={index}
                  showCategory
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
          description={`Share your details to purchase ${suite.name} or individual agencies. No payment is collected on this page.`}
          bullets={[
            "Response by email from the AES team",
            "Guidance on agencies vs suite",
            "Access unlocked after admin follow-up",
          ]}
        >
          <SalesInquiryForm
            variant="dark"
            bundleSlug={suite.slug}
            interest={suite.name}
            ctaLabel="Send purchase details"
            showNote
          />
        </InquireSection>
      </main>

      <SalesFooter />
    </div>
  );
}
