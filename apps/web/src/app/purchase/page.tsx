"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SalesInquiryForm } from "@/components/sales/SalesInquiryForm";
import { InquireSection } from "@/components/sales/InquireSection";
import { SalesFooter, SalesHeader } from "@/components/sales/SalesChrome";
import { useNavigateBack } from "@/hooks/useNavigateBack";
import { apiFetch } from "@/lib/api";
import type { CatalogPayload } from "@/lib/sales/catalog";
import "@/components/sales/purchase-flow.css";
import "@/components/sales/inquiry-form.css";
import "@/components/sales/sales.css";

function InquiryFlowInner() {
  const searchParams = useSearchParams();
  const goBack = useNavigateBack("/sales");
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<CatalogPayload>("/api/catalog")
      .then((data) =>
        setCatalog({
          ...data,
          bundles: data.bundles ?? (data.suite ? [data.suite] : []),
        })
      )
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const focus = searchParams.get("focus");
  const suite = searchParams.get("suite");
  const bundleSlug = searchParams.get("bundle");

  const interest = useMemo(() => {
    if (!catalog) return "AI Enterprise Studio";
    if (bundleSlug) {
      return catalog.bundles.find((b) => b.slug === bundleSlug)?.name || catalog.suite.name;
    }
    if (suite === "1") return catalog.suite.name;
    if (focus) return catalog.agencies.find((a) => a.slug === focus)?.name || focus;
    return catalog.suite.name;
  }, [catalog, focus, suite, bundleSlug]);

  const productSlug = focus && catalog?.agencies.some((a) => a.slug === focus) ? focus : undefined;
  const resolvedBundleSlug =
    bundleSlug ||
    (suite === "1" ? catalog?.suite.slug : undefined) ||
    (!productSlug ? catalog?.suite.slug : undefined);

  return (
    <div className="sales-root sales-purchase-page">
      <SalesHeader />
      <main className="inquiry-page">
        <InquireSection
          title={
            <>
              Tell us what you need.
              <span> We will unlock access.</span>
            </>
          }
          description={`Share your details about ${interest}. No payment is collected on this page.`}
          bullets={[
            "Response by email from the AES team",
            "Guidance on the right agency or pack",
            "Access unlocked after admin follow-up",
          ]}
        >
          {loadError ? <p className="inquiry-form-error">{loadError}</p> : null}
          {!catalog && !loadError ? <p className="inquiry-form-note">Loading…</p> : null}
          {catalog ? (
            <SalesInquiryForm
              variant="dark"
              productSlug={productSlug}
              bundleSlug={resolvedBundleSlug}
              interest={interest}
              ctaLabel="Send purchase details"
              showNote
            />
          ) : null}
          <button type="button" className="inquiry-page-back" onClick={goBack}>
            Back
          </button>
        </InquireSection>
      </main>
      <SalesFooter />
    </div>
  );
}

export default function PurchasePage() {
  return (
    <Suspense fallback={<div className="panel muted">Loading…</div>}>
      <InquiryFlowInner />
    </Suspense>
  );
}
