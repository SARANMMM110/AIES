export type ProblemCard = { title: string; body: string; icon: string };

export const AGENCY_PROBLEMS: Record<string, ProblemCard[]> = {
  "ai-advantage-agency": [
    { icon: "01", title: "Unclear opportunities", body: "Teams know AI matters but cannot prioritize where it creates real operating value." },
    { icon: "02", title: "Manual, repetitive work", body: "High-effort tasks stay manual because there is no structured workflow system." },
    { icon: "03", title: "Scattered information", body: "Useful prompts and process knowledge live in chats, docs, and personal habits." },
    { icon: "04", title: "Lack of governance", body: "Nobody owns quality, risk, or when a human must approve AI outputs." },
  ],
  "booking-flow-agency": [
    { icon: "01", title: "Slow enquiry response", body: "Leads cool while teams scramble for the next step." },
    { icon: "02", title: "Weak qualification", body: "Unready leads clog calendars and burn operator time." },
    { icon: "03", title: "Broken follow-up", body: "Reminders and recovery depend on memory, not a system." },
    { icon: "04", title: "Invisible conversion", body: "Teams cannot see where booking drop-offs actually happen." },
  ],
  "demand-builder-agency": [
    { icon: "01", title: "Campaigns without a system", body: "Offers and audiences change every week with no reusable playbook." },
    { icon: "02", title: "Fuzzy positioning", body: "Messages compete instead of compounding demand." },
    { icon: "03", title: "One-off creative", body: "Assets are rebuilt from scratch instead of evolving." },
    { icon: "04", title: "Hard to hand off", body: "Operators struggle to run demand work consistently across clients." },
  ],
  "local-alliance-agency": [
    { icon: "01", title: "Ad-hoc partnerships", body: "Referrals and alliances depend on personal relationships alone." },
    { icon: "02", title: "Unclear mutual value", body: "Partners do not know what to promote or how to measure fit." },
    { icon: "03", title: "No alliance cadence", body: "Introductions stall without a structured outreach and follow-up loop." },
    { icon: "04", title: "Hard to package", body: "Agencies lack a productized way to sell alliance-building." },
  ],
  "local-presence-agency": [
    { icon: "01", title: "Inconsistent listings", body: "Profiles and NAP details drift across platforms." },
    { icon: "02", title: "Weak local profiles", body: "Categories, photos, and services are incomplete or outdated." },
    { icon: "03", title: "No presence playbook", body: "Teams react to issues instead of running a presence system." },
    { icon: "04", title: "Multi-location chaos", body: "Operators cannot coordinate presence standards across sites." },
  ],
  "referral-loop-agency": [
    { icon: "01", title: "Referrals left to chance", body: "Happy customers are never asked through a clear process." },
    { icon: "02", title: "Broken ask timing", body: "Requests land too early, too late, or never." },
    { icon: "03", title: "No tracking loop", body: "Teams cannot see which asks produce introductions." },
    { icon: "04", title: "Awkward scripts", body: "Staff improvises referral conversations without a shared framework." },
  ],
  "repeat-revenue-agency": [
    { icon: "01", title: "One-and-done relationships", body: "Customers leave after the first engagement with no rebooking path." },
    { icon: "02", title: "Unplanned renewals", body: "Retention depends on memory instead of lifecycle triggers." },
    { icon: "03", title: "Weak reactivation", body: "Quiet accounts are ignored until they are gone." },
    { icon: "04", title: "No retention offer system", body: "Upsells and continuity offers are inconsistent across operators." },
  ],
  "revenue-revival-agency": [
    { icon: "01", title: "Dormant lead piles", body: "Old enquiries sit unused with no reactivation plan." },
    { icon: "02", title: "Generic win-back blasts", body: "Messages ignore context, timing, and offer fit." },
    { icon: "03", title: "No revival cadence", body: "Teams lack a sequenced approach to re-engage past demand." },
    { icon: "04", title: "Unclear recovery ownership", body: "Nobody owns which lists get reviewed and when." },
  ],
  "trust-builder-agency": [
    { icon: "01", title: "Uneven review coverage", body: "Proof and ratings vary wildly by location or service line." },
    { icon: "02", title: "Slow or risky replies", body: "Public responses are delayed or poorly reviewed." },
    { icon: "03", title: "Weak recovery process", body: "Negative feedback has no structured escalation path." },
    { icon: "04", title: "Proof assets unused", body: "Testimonials and case studies never enter a distribution system." },
  ],
  "video-authority-agency": [
    { icon: "01", title: "Random video output", body: "Content appears without pillars, cadence, or audience focus." },
    { icon: "02", title: "Production bottlenecks", body: "Ideas stall because briefs and roles are unclear." },
    { icon: "03", title: "No repurposing system", body: "Long-form work is published once and abandoned." },
    { icon: "04", title: "Unreviewed claims", body: "Expertise risks brand issues without editorial gates." },
  ],
};
