"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InquiryForm } from "@/components/sales/InquiryForm";
import { InquireSection } from "@/components/sales/InquireSection";
import { apiFetch, ApiClientError } from "@/lib/api";
import "@/components/sales/inquiry-form.css";
import "@/components/sales/sales.css";

type Offer = {
  slug: string;
  title: string;
  description: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  brandAccent: string | null;
  salesCopy: string | null;
  ctaText: string;
  attribution: string;
  brand: {
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    supportEmail: string | null;
    website: string | null;
    footerText: string | null;
  } | null;
  products: Array<{ name: string; slug: string; shortDescription: string | null; services: string[] }>;
};

export default function PublicResellerOfferPage() {
  const params = useParams<{ slug: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Offer>(`/api/reseller/public/offers/${params.slug}`)
      .then(setOffer)
      .catch((err: Error) => setError(err.message));
  }, [params.slug]);

  if (error && !offer) {
    return (
      <div className="aes-inquire" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="inquiry-form-error">{error}</p>
      </div>
    );
  }
  if (!offer) {
    return (
      <div className="aes-inquire" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="inquiry-form-note">Loading offer…</p>
      </div>
    );
  }

  const brand = offer.brand?.brandName || offer.brandName || "Offer";
  const accent = offer.brandAccent || offer.brand?.primaryColor || "#d9f464";

  return (
    <div className="inquiry-page" style={{ ["--sales-accent" as string]: accent, minHeight: "100vh" }}>
      <InquireSection
        kicker={brand}
        title={
          <>
            Tell us what you need.
            <span> We will unlock access.</span>
          </>
        }
        description={`${offer.salesCopy || offer.description || "Tell the owner what you need. They will reply by email."} There is no payment on this page.`}
        bullets={[
          `Offer: ${offer.title}`,
          ...offer.products.slice(0, 2).map((p) => p.name),
          "Owner follows up by email",
        ]}
      >
        {offer.brandLogoUrl || offer.brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(offer.brand?.logoUrl || offer.brandLogoUrl) as string}
            alt=""
            style={{ height: 36, width: "auto", marginBottom: 8, borderRadius: 6 }}
          />
        ) : null}
        <InquiryForm
          variant="dark"
          ctaLabel={offer.ctaText || "Send purchase details"}
          note="Share your purchase details and we will unlock access by email."
          successMessage="Details received. The owner will email you."
          onSubmit={async (values) => {
            try {
              await apiFetch(`/api/reseller/public/offers/${params.slug}/inquiry`, {
                method: "POST",
                body: JSON.stringify(values),
              });
            } catch (err) {
              throw new Error(err instanceof ApiClientError ? err.message : "Could not send your details");
            }
          }}
        />
        {offer.brand?.supportEmail ? (
          <p className="inquiry-form-note">
            {offer.brand.supportEmail}
            {offer.brand.website ? ` · ${offer.brand.website}` : ""}
          </p>
        ) : null}
        <p className="inquiry-form-note">
          {[offer.brand?.footerText, offer.attribution].filter(Boolean).join(" ")}
        </p>
      </InquireSection>
    </div>
  );
}
