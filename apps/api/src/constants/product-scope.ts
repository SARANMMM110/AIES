/**
 * Fixed product catalog scope for AI Enterprise Studio.
 * Exactly 10 vendor tools — never invent additional agencies.
 */
export const APPROVED_PRODUCT_SLUGS = [
  "ai-advantage-agency",
  "booking-flow-agency",
  "demand-builder-agency",
  "local-alliance-agency",
  "local-presence-agency",
  "referral-loop-agency",
  "repeat-revenue-agency",
  "revenue-revival-agency",
  "trust-builder-agency",
  "video-authority-agency",
] as const;

export const APPROVED_PRODUCT_NAMES = [
  "AI Advantage Agency",
  "Booking Flow Agency",
  "Demand Builder Agency",
  "Local Alliance Agency",
  "Local Presence Agency",
  "Referral Loop Agency",
  "Repeat Revenue Agency",
  "Revenue Revival Agency",
  "Trust Builder Agency",
  "Video Authority Agency",
] as const;

export const FORBIDDEN_SCOPE_TERMS = [
  "Agency Building",
  "Agency Builder",
  "Generic Agency",
  "Agency System",
  "AI Agency",
  "Workflow Agency",
  "Business Builder",
  "Enterprise Agency",
  "Marketing Agency",
  "Operations Agency",
  "Sample Agency",
  "Locked Agency",
  "Sample Agency Module",
] as const;

export function isApprovedProductSlug(slug: string): boolean {
  return (APPROVED_PRODUCT_SLUGS as readonly string[]).includes(slug);
}

export function containsForbiddenScopeTerm(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  for (const term of FORBIDDEN_SCOPE_TERMS) {
    if (normalized === term.toLowerCase() || normalized.includes(term.toLowerCase())) {
      return term;
    }
  }
  return null;
}
