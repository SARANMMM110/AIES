/** Sales-page artwork for the fixed 10-agency catalog. */
export const AGENCY_SALES_IMAGES: Record<string, string> = {
  "ai-advantage-agency": "/images/agencies/ai-advantage-agency.png",
  "booking-flow-agency": "/images/agencies/booking-flow-agency.png",
  "demand-builder-agency": "/images/agencies/demand-builder-agency.png",
  "local-alliance-agency": "/images/agencies/local-alliance-agency.png",
  "local-presence-agency": "/images/agencies/local-presence-agency.png",
  "referral-loop-agency": "/images/agencies/referral-loop-agency.png",
  "repeat-revenue-agency": "/images/agencies/repeat-revenue-agency.png",
  "revenue-revival-agency": "/images/agencies/revenue-revival-agency.png",
  "trust-builder-agency": "/images/agencies/trust-builder-agency.png",
  "video-authority-agency": "/images/agencies/video-authority-agency.png",
};

export function agencySalesImage(slug: string): string | null {
  return AGENCY_SALES_IMAGES[slug] ?? null;
}
