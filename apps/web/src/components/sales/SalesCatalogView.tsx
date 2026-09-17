"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import type { CatalogAgency, CatalogBundle } from "@/lib/sales/catalog";
import { agencySalesImage } from "@/lib/sales/agency-images";
import { formatMoney } from "@/lib/purchase";
import { CatalogAgencyCard } from "./CatalogAgencyCard";
import { SalesInquiryForm } from "./SalesInquiryForm";
import { InquireSection } from "./InquireSection";
import { SalesFooter, SalesHeader } from "./SalesChrome";
import { SalesResaleSection } from "./SalesResaleSection";
import "./purchase-flow.css";
import "./catalog-sales.css";
import "./inquiry-form.css";

type Props = {
  agencies: CatalogAgency[];
  bundles: CatalogBundle[];
  suite: CatalogBundle;
  totals: { products: number; services: number; workflows: number; bundles?: number };
};

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Choose your agencies",
    body: "Pick one agency, a published bundle, or the complete suite. Each product is independently usable.",
  },
  {
    step: "02",
    title: "Purchase with our team",
    body: "Share your details on this page. We follow up by email — there is no payment gateway here.",
  },
  {
    step: "03",
    title: "Operate, resell, or brand",
    body: "Use agencies in your studio. After purchase, enable resale and optional white-label from your account.",
  },
] as const;

const INCLUDED = [
  {
    title: "Guided services",
    body: "Structured service menus inside every agency so teams know what to run and when.",
  },
  {
    title: "Step-by-step workflows",
    body: "Prompt-ready workflows with human review built in — not autonomous client changes.",
  },
  {
    title: "Operator resources",
    body: "Sales pages, positioning, and operator guidance live with each product workspace.",
  },
  {
    title: "Client & project context",
    body: "Keep delivery organized by client and project while results stay independent.",
  },
] as const;

const AUDIENCE = [
  {
    index: "01",
    title: "Agency operators",
    body: "Run specialized AI delivery systems without building every process from scratch.",
  },
  {
    index: "02",
    title: "Consultants & studios",
    body: "Package services clearly, deliver with guided workflows, and keep review in human hands.",
  },
  {
    index: "03",
    title: "Resellers",
    body: "Sell agencies you purchased, set your own pricing, and optionally white-label your sales pages.",
  },
] as const;

const FAQS = [
  {
    q: "What is AI Enterprise Studio?",
    a: "A platform of independent AI agency products — each with services and guided workflows — that you can use in your studio, and optionally resell or white-label after purchase.",
  },
  {
    q: "Is there payment on this page?",
    a: "No. Sales pages collect inquiries only. Our team follows up by email about access and next steps.",
  },
  {
    q: "Can I buy one agency or the full suite?",
    a: "Yes. Every agency is independently sellable. You can also inquire about published bundles or the Complete Suite.",
  },
  {
    q: "How does resale work?",
    a: "After you purchase from AES, turn on resale in Account. Create offers, collect customer inquiries, and manage branding in the reseller portal. Your customers get use access only.",
  },
  {
    q: "What is white label?",
    a: "Optional branding for the sales pages you publish — logo, brand name, and colors. Access still runs through AI Enterprise Studio.",
  },
  {
    q: "Does AI change client accounts automatically?",
    a: "No. Human review, approvals, and permissions stay with the appropriate people.",
  },
] as const;

export function SalesCatalogView({ agencies, bundles, suite, totals }: Props) {
  const heroImages = agencies
    .map((agency) => ({ slug: agency.slug, name: agency.name, src: agencySalesImage(agency.slug) }))
    .filter((row): row is { slug: string; name: string; src: string } => Boolean(row.src))
    .slice(0, 6);

  return (
    <div
      className="sales-root catalog-page"
      style={
        {
          ["--sales-accent"]: "#c8f04d",
          ["--green"]: "#c8f04d",
          ["--sales-accent-ink"]: "#0c1411",
        } as CSSProperties
      }
    >
      <SalesHeader />

      <main>
        <section className="cat-hero" aria-labelledby="catalog-hero-title">
          <div className="cat-hero-bg" aria-hidden />
          <div className="container cat-hero-grid">
            <div className="cat-hero-copy">
              <p className="cat-brand-mark">AI Enterprise Studio</p>
              <h1 id="catalog-hero-title">
                Agency systems
                <span>built to run,</span>
                <span className="cat-hero-accent">resell, and brand.</span>
              </h1>
              <p className="cat-hero-lead">
                Ten specialized agencies with guided services and workflows — use them in your studio,
                or enable resale and white-label after purchase.
              </p>
              <div className="cat-hero-actions">
                <a className="btn lime" href="#agencies">
                  Explore agencies →
                </a>
                <a className="btn cat-btn-ghost" href="#how">
                  How it works
                </a>
              </div>
            </div>

            <div className="cat-hero-stage" aria-hidden={heroImages.length === 0}>
              <div className="cat-hero-mosaic">
                {heroImages.map((item, i) => (
                  <figure key={item.slug} className={`cat-hero-tile cat-hero-tile-${i + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt="" width={640} height={480} />
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="cat-section" id="how">
          <div className="container">
            <header className="cat-head">
              <div>
                <p className="cat-kicker">How it works</p>
                <h2>From catalog to operating system.</h2>
              </div>
              <p>A simple path from browsing agencies to running delivery — and optionally reselling under your brand.</p>
            </header>
            <ol className="cat-steps">
              {HOW_IT_WORKS.map((item) => (
                <li key={item.step}>
                  <span className="cat-step-num">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="cat-section cat-section-ink" id="included">
          <div className="container">
            <header className="cat-head on-dark">
              <div>
                <p className="cat-kicker on-dark">What you get</p>
                <h2>
                  {totals.products} agencies · {totals.services} services · {totals.workflows} workflows
                </h2>
              </div>
              <p>
                Live catalog counts. Every agency ships as a complete product structure — not a loose prompt pack.
              </p>
            </header>
            <div className="cat-included">
              {INCLUDED.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cat-section" id="agencies">
          <div className="container">
            <header className="cat-head">
              <div>
                <p className="cat-kicker">Catalog</p>
                <h2>{agencies.length} independent agencies</h2>
              </div>
              <p>Each agency is separately usable and sellable. Open any product for full sales detail.</p>
            </header>
            <div className="catalog-agency-grid">
              {agencies.map((agency, index) => (
                <CatalogAgencyCard key={agency.slug} agency={agency} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="cat-section cat-audience-section" id="audience">
          <div className="container">
            <header className="cat-audience-head">
              <p className="cat-kicker">Who it is for</p>
              <div className="cat-audience-title-row">
                <h2>Built for operators who ship work.</h2>
                <p>
                  Whether you deliver for clients or resell access, the studio keeps ownership and
                  review clear.
                </p>
              </div>
            </header>
            <div className="cat-audience-rail">
              {AUDIENCE.map((item) => (
                <article key={item.title} className="cat-audience-panel">
                  <span className="cat-audience-index">{item.index}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SalesResaleSection />

        <section className="cat-section" id="bundles">
          <div className="container">
            <header className="cat-head">
              <div>
                <p className="cat-kicker">Bundles</p>
                <h2>Packs when you need more than one.</h2>
              </div>
              <p>Published packs only. Draft combinations stay admin-only until they go live.</p>
            </header>
            <div className="cat-bundle-rail">
              {bundles.length === 0 ? (
                <p className="cat-bundle-body">No published packs yet. Check back soon.</p>
              ) : (
                bundles.map((bundle) => (
                <article
                  key={bundle.slug}
                  className={`cat-bundle${bundle.isCompleteSuite ? " is-suite" : ""}`}
                >
                  {bundle.thumbnailUrl ? (
                    <div className="cat-bundle-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bundle.thumbnailUrl}
                        alt=""
                        width={640}
                        height={360}
                      />
                    </div>
                  ) : bundle.icon ? (
                    <div className="cat-bundle-media cat-bundle-media-fallback" aria-hidden>
                      <span>{bundle.icon}</span>
                    </div>
                  ) : null}
                  <p className="cat-bundle-label">
                    {bundle.isCompleteSuite ? "Complete Suite" : "Bundle"}
                  </p>
                  <h3>{bundle.name}</h3>
                  <p className="cat-bundle-tag">{bundle.tagline}</p>
                  <p className="cat-bundle-meta">
                    {bundle.agencyCount} agencies · {bundle.serviceCount} services ·{" "}
                    {bundle.workflowCount} workflows
                  </p>
                  <p className="cat-bundle-price">
                    {formatMoney(bundle.priceCents, bundle.currency)}
                    {bundle.savingsCents
                      ? ` · save ${formatMoney(bundle.savingsCents, bundle.currency)}`
                      : ""}
                  </p>
                  <p className="cat-bundle-body">
                    {bundle.shortDescription || bundle.description || bundle.tagline}
                  </p>
                  <Link className="btn lime" href={`/sales/bundles/${bundle.slug}`}>
                    View pack →
                  </Link>
                </article>
              ))
              )}
            </div>
          </div>
        </section>

        <section className="cat-section cat-section-soft" id="faq">
          <div className="container cat-faq-wrap">
            <header className="cat-head stacked">
              <div>
                <p className="cat-kicker">FAQ</p>
                <h2>Clear answers before you inquire.</h2>
              </div>
            </header>
            <div className="cat-faq">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <InquireSection
          title={
            <>
              Tell us what you need.
              <span> We will unlock access.</span>
            </>
          }
          description={`Share your details to purchase ${suite.name}, individual agencies, resale, or white-label setup. No payment is collected on this page.`}
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
