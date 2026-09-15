"use client";

import { InquiryForm } from "./InquiryForm";
import { apiFetch, ApiClientError } from "@/lib/api";

type Props = {
  productSlug?: string;
  bundleSlug?: string;
  interest?: string;
  ctaLabel?: string;
  variant?: "light" | "dark";
  className?: string;
  showNote?: boolean;
};

export function SalesInquiryForm({
  productSlug,
  bundleSlug,
  interest,
  ctaLabel = "Send purchase details",
  variant = "dark",
  className,
  showNote = false,
}: Props) {
  return (
    <InquiryForm
      className={className}
      variant={variant}
      ctaLabel={ctaLabel}
      note={showNote ? "Share your purchase details and we will unlock access by email." : null}
      successMessage="Purchase details received. Our team will email you shortly."
      onSubmit={async (values) => {
        try {
          await apiFetch("/api/sales/inquiries", {
            method: "POST",
            body: JSON.stringify({
              ...values,
              productSlug,
              bundleSlug,
              interest,
            }),
          });
        } catch (err) {
          throw new Error(err instanceof ApiClientError ? err.message : "Could not send your details");
        }
      }}
    />
  );
}
