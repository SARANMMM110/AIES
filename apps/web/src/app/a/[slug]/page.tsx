"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InquiryForm } from "@/components/sales/InquiryForm";
import { InquireSection } from "@/components/sales/InquireSection";
import { apiFetch, ApiClientError } from "@/lib/api";
import "@/components/sales/inquiry-form.css";
import "@/components/sales/sales.css";

type Page = {
  title: string;
  brandName: string | null;
  logoUrl: string | null;
  accent: string;
  supportEmail: string | null;
  website: string | null;
  footerText: string | null;
  agency: string;
  summary: string | null;
  services: string[];
  offer: { title: string; copy: string | null; ctaText: string; priceCents?: number; currency?: string } | null;
  attribution: string;
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export default function AgencySalesPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Page>(`/api/reseller/public/agencies/${params.slug}`)
      .then(setPage)
      .catch((err: Error) => setError(err.message));
  }, [params.slug]);

  if (error && !page) {
    return (
      <div className="aes-inquire" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="inquiry-form-error">{error}</p>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="aes-inquire" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="inquiry-form-note">Loading…</p>
      </div>
    );
  }

  const brand = page.brandName || page.agency;
  const headline = page.offer?.title || page.title;
  const copy =
    page.offer?.copy ||
    page.summary ||
    "Tell the owner what you need. They will reply by email.";
  const priceLabel =
    page.offer?.priceCents && page.offer.priceCents > 0
      ? money(page.offer.priceCents, page.offer.currency || "USD")
      : null;

  return (
    <div
      className="inquiry-page"
      style={{ ["--sales-accent" as string]: page.accent || "#d9f464", minHeight: "100vh" }}
    >
      <InquireSection
        kicker={brand}
        title={
          <>
            Tell us what you need.
            <span> We will unlock access.</span>
          </>
        }
        description={`${copy}${priceLabel ? ` Listed price ${priceLabel}.` : ""} There is no payment on this page.`}
        bullets={[
          `Enquiry for ${headline}`,
          "Owner follows up by email",
          "No payment on this page",
        ]}
      >
        {page.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.logoUrl} alt="" style={{ height: 36, width: "auto", marginBottom: 8, borderRadius: 6 }} />
        ) : null}
        <InquiryForm
          variant="dark"
          ctaLabel={page.offer?.ctaText || "Send purchase details"}
          note="Share your purchase details and we will unlock access by email."
          successMessage="Details received. The owner will email you."
          onSubmit={async (values) => {
            try {
              await apiFetch(`/api/reseller/public/agencies/${params.slug}/inquiry`, {
                method: "POST",
                body: JSON.stringify(values),
              });
            } catch (err) {
              throw new Error(
                err instanceof ApiClientError
                  ? err.message
                  : "Could not send your details. Please try again."
              );
            }
          }}
        />
        {page.supportEmail ? <p className="inquiry-form-note">{page.supportEmail}</p> : null}
        {page.footerText ? <p className="inquiry-form-note">{page.footerText}</p> : null}
        <p className="inquiry-form-note">{page.attribution}</p>
      </InquireSection>
    </div>
  );
}
