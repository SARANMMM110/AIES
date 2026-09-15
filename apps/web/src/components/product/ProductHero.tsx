"use client";

import { displayAgencyName } from "./ProductShell";
import type { ProductWorkspace } from "./types";

const FEATURES_BY_CATEGORY: Record<string, [string, string][]> = {
  "AI Enablement": [
    ["🚀", "Practical AI Opportunities"],
    ["📊", "More Efficient Workflows"],
    ["👥", "Real Business Improvement"],
  ],
  "Lead Conversion": [
    ["📞", "Faster Lead Response"],
    ["📅", "Higher Booking Rates"],
    ["🔁", "Fewer Missed Enquiries"],
  ],
  "Demand Generation": [
    ["📣", "Campaign-Ready Offers"],
    ["📈", "Demand in Quiet Periods"],
    ["🎯", "Local Promotion Systems"],
  ],
  Partnerships: [
    ["🤝", "Partner Identification"],
    ["🔗", "Co-Marketing Motions"],
    ["📍", "Local Alliance Growth"],
  ],
  "Local Visibility": [
    ["🗺️", "Stronger Local Presence"],
    ["📸", "Profile Optimization"],
    ["✅", "Listing Consistency"],
  ],
  Referrals: [
    ["🔁", "Referral Loops"],
    ["🎁", "Incentive Systems"],
    ["👥", "Professional Networks"],
  ],
  Retention: [
    ["💝", "Repeat Revenue"],
    ["📅", "Rebooking Systems"],
    ["📊", "Customer Value Growth"],
  ],
  Reactivation: [
    ["♻️", "Revive Dormant Leads"],
    ["📩", "Estimate Follow-Up"],
    ["🔥", "Revenue Recovery"],
  ],
  Reputation: [
    ["⭐", "Review Systems"],
    ["🛡️", "Trust Content"],
    ["💬", "Reputation Recovery"],
  ],
  "Video Authority": [
    ["🎬", "Expert Positioning"],
    ["📱", "Short-Form Systems"],
    ["🎥", "Authority Content Plans"],
  ],
};

export function ProductHero({ product }: { product: ProductWorkspace }) {
  const wf =
    product.workflowCatalog?.definedCount ??
    product.workflowCatalog?.targetCount ??
    product.workflowCount;
  const category =
    (product.configuration?.category as string) || product.tagline || "Agency System";
  const features =
    FEATURES_BY_CATEGORY[category] || FEATURES_BY_CATEGORY["AI Enablement"];
  const title = displayAgencyName(product.name);

  return (
    <section id="hero" className="as-hero">
      <div>
        <span className="as-pill">Agency Business Builder & Operations System</span>
        <h1>{title}</h1>
        <p className="as-hero-copy">
          {product.shortDescription ||
            product.description ||
            "Build a practical agency system with guided workflows and human review."}
        </p>
        <div className="as-features">
          {features.map(([icon, label]) => (
            <div key={label} className="as-feature">
              <span className="as-feature-icon" aria-hidden>
                {icon}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
      <aside className="as-wf-card" aria-label="Workflow count">
        <div className="as-wf-card-icon" aria-hidden>
          ⌁
        </div>
        <h2>Generate {wf} Custom Agency Workflows</h2>
        <p>
          Select your AI platform and define your agency profile to unlock guided workflows tailored
          to this agency model.
        </p>
        <div className="as-wf-count">
          <strong>{wf}</strong>
          <span>Guided Workflows</span>
        </div>
      </aside>
    </section>
  );
}

export function ProductStats() {
  return null;
}
