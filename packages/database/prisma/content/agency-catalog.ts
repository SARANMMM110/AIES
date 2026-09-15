/**
 * AI Enterprise Studio — Stage 3A agency catalog (source of truth).
 *
 * Approved agency concepts and exact service names for Client 5DF.
 * Original AES content slots are structured here; Stage 3B authors full
 * Operator Guides, Sales Pages, Sales Copy, Strategy, and workflows.
 *
 * Do not invent or claim vendor-imported workflow/guide HTML content.
 */

export type AgencyCatalogEntry = {
  name: string;
  slug: string;
  tagline: string;
  shortDescription: string;
  description: string;
  category: string;
  icon: string;
  /** Unique product accent (hex) — each agency must use a distinct hue. */
  accent: string;
  sortOrder: number;
  /** Structural workflow-count target for Stage 3B (from product architecture). */
  workflowTargetCount: number;
  /** Ideal-client framing for AES strategy / positioning slots. */
  idealClient: string;
  /** Problems this agency addresses. */
  problemsAddressed: string[];
  /** Value proposition (AES original framing). */
  valueProposition: string;
  services: string[];
};

export const FAQ_PRINCIPLES = [
  "Users do not need to launch all 10 agencies — choose the model that fits.",
  "Freelancers and agencies may use a single agency product independently.",
  "These are operating/production systems, not autonomous client-account software.",
  "Human research, approval, implementation, permissions and quality review remain required.",
  "External AI provider plans and usage costs are separate.",
  "Standard collection licensing does not automatically grant commercial white-label/resale rights.",
  "No income or client-acquisition guarantee is represented.",
] as const;

export const AGENCY_BUILDER_FIELD_KEYS = [
  "aiPlatform",
  "agencyName",
  "country",
  "targetNiche",
  "geographicServiceArea",
  "experienceLevel",
  "preferredDeliveryModel",
  "weeklyTimeAvailability",
  "monthlyIncomeOrClientTarget",
  "selectedServiceIds",
] as const;

/** Fixed final catalog — exactly these 10 products may be published/active. */
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

export type ApprovedProductSlug = (typeof APPROVED_PRODUCT_SLUGS)[number];

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

/** Terms that must never appear as product / service / workflow category / fallback. */
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

export const AGENCY_CATALOG: AgencyCatalogEntry[] = [
  {
    name: "AI Advantage Agency",
    slug: "ai-advantage-agency",
    tagline: "AI Enablement & Workflow Consulting",
    shortDescription:
      "Help clients adopt AI responsibly with audits, roadmaps, SOPs, and enablement systems.",
    description:
      "AI Advantage Agency is an AI Enterprise Studio operating system for AI enablement and workflow consulting. Operators audit readiness, map processes, prioritize use cases, and install prompt systems, SOPs, and governance — with human approval required before any client implementation.",
    category: "AI Enablement",
    icon: "AA",
    accent: "#caff45",
    sortOrder: 1,
    workflowTargetCount: 31,
    idealClient:
      "Service and professional businesses ready to adopt AI workflows with governance, not autonomous bots.",
    problemsAddressed: [
      "Unclear AI readiness and scattered experiments",
      "No prioritized use-case roadmap",
      "Missing SOPs, prompts, and quality controls",
    ],
    valueProposition:
      "Install practical AI enablement systems that improve marketing, communication, and operations without replacing human judgment.",
    services: [
      "AI Readiness and Opportunity Audit",
      "Process and Task Mapping",
      "AI Use-Case Prioritization and Roadmap",
      "Prompt Systems and Workflow SOPs",
      "Marketing and Content Workflow Enablement",
      "Customer Communication Workflow Enablement",
      "Administration and Operations Workflow Enablement",
      "Knowledge Base and Staff Enablement",
      "AI Governance, Risk and Quality Controls",
      "AI Reporting and Optimization",
    ],
  },
  {
    name: "Booking Flow Agency",
    slug: "booking-flow-agency",
    tagline: "Lead-to-Appointment Conversion",
    shortDescription:
      "Convert enquiries into booked appointments with structured lead-handling systems.",
    description:
      "Booking Flow Agency focuses on lead-to-appointment conversion: enquiry response, qualification, multi-channel follow-up, booking, reminders, and no-show recovery. Operators research, approve, and implement changes with client permission.",
    category: "Lead Conversion",
    icon: "BF",
    accent: "#EA580C",
    sortOrder: 2,
    workflowTargetCount: 31,
    idealClient:
      "Local and service businesses that live on booked appointments and estimates.",
    problemsAddressed: [
      "Slow or inconsistent enquiry response",
      "Missed calls and dropped follow-ups",
      "No-shows and weak booking confirmation systems",
    ],
    valueProposition:
      "Build a reliable enquiry-to-booking operating system that recovers missed opportunities and improves conversion.",
    services: [
      "Lead Handling Audit",
      "Instant Enquiry Response System",
      "Missed-Call Text-Back System",
      "Lead Qualification System",
      "Multi-Channel Follow-Up System",
      "Appointment & Estimate Booking System",
      "FAQ & Objection Response System",
      "Confirmation & Reminder System",
      "Cancellation & No-Show Recovery System",
      "Booking Conversion Reporting",
    ],
  },
  {
    name: "Demand Builder Agency",
    slug: "demand-builder-agency",
    tagline: "Promotions, Campaigns & Capacity",
    shortDescription:
      "Plan promotional calendars and campaigns that fill capacity without inventing offers blindly.",
    description:
      "Demand Builder Agency helps operators design promotions, seasonal campaigns, quiet-period demand, launches, and local event campaigns — with human approval and quality review required before any client-facing publish.",
    category: "Demand Generation",
    icon: "DB",
    accent: "#16A34A",
    sortOrder: 3,
    workflowTargetCount: 31,
    idealClient:
      "Businesses with spare capacity that need structured promotions and campaign calendars.",
    problemsAddressed: [
      "Inconsistent promotional planning",
      "Quiet periods with unused capacity",
      "Weak campaign assets and measurement",
    ],
    valueProposition:
      "Create demand systems that fill capacity through planned offers, seasonal campaigns, and measurable multi-channel assets.",
    services: [
      "Demand and Promotion Audit",
      "Promotional Calendar Planning",
      "Campaign Strategy and Concept Development",
      "Offer and Promotion Development",
      "Seasonal Demand Campaigns",
      "Quiet-Period and Capacity Campaigns",
      "New Service, Product and Location Launches",
      "Local Event and Community Campaigns",
      "Multi-Channel Campaign Asset Packs",
      "Campaign Reporting and Optimization",
    ],
  },
  {
    name: "Local Alliance Agency",
    slug: "local-alliance-agency",
    tagline: "Partnerships & Co-Marketing",
    shortDescription:
      "Build partner maps, joint offers, and co-marketing systems for local growth.",
    description:
      "Local Alliance Agency is the partnership and co-marketing operating system: opportunity audits, partner outreach, joint offers, events, sponsorships, and governance — operated by humans with client permissions.",
    category: "Partnerships",
    icon: "LA",
    accent: "#7C3AED",
    sortOrder: 4,
    workflowTargetCount: 31,
    idealClient:
      "Local businesses that grow through complementary partners and community collaboration.",
    problemsAddressed: [
      "No clear partner map or outreach system",
      "One-off collaborations without governance",
      "Missed co-marketing and audience-sharing opportunities",
    ],
    valueProposition:
      "Install repeatable partnership systems that create joint offers, co-marketing, and accountable partner growth.",
    services: [
      "Partnership Opportunity Audit",
      "Ideal Partner Mapping",
      "Partner Outreach and Recruitment",
      "Joint Offer and Bundle Development",
      "Co-Marketing Campaigns",
      "Local Event and Workshop Partnerships",
      "Cross-Promotion and Audience Sharing",
      "Sponsorship and Community Collaboration",
      "Partner Onboarding and Governance",
      "Partnership Reporting and Growth",
    ],
  },
  {
    name: "Local Presence Agency",
    slug: "local-presence-agency",
    tagline: "Profiles, Listings & Local Visibility",
    shortDescription:
      "Strengthen business profiles, listings, photos, posts, and multi-location presence.",
    description:
      "Local Presence Agency covers local visibility systems: profile optimization, categories, services/menus, visuals, posts, Q&A, listing consistency, and multi-location presence — without autonomous publishing to client accounts.",
    category: "Local Visibility",
    icon: "LP",
    accent: "#E11D48",
    sortOrder: 5,
    workflowTargetCount: 30,
    idealClient:
      "Local and multi-location businesses that need accurate, trustworthy online presence.",
    problemsAddressed: [
      "Inconsistent NAP and listing data",
      "Weak profile visuals and category setup",
      "No cadence for posts, Q&A, and presence reporting",
    ],
    valueProposition:
      "Operate a local presence system that keeps profiles, listings, and multi-location visibility accurate and useful.",
    services: [
      "Local Presence Audit",
      "Business Profile Setup and Optimization",
      "Business Information and Category Management",
      "Services, Products and Menu Management",
      "Photo and Visual Presence Management",
      "Local Post and Update Management",
      "Questions and Answers Management",
      "Local Listing Consistency",
      "Multi-Location Presence Management",
      "Presence Reporting and Optimization",
    ],
  },
  {
    name: "Referral Loop Agency",
    slug: "referral-loop-agency",
    tagline: "Customer & Professional Referrals",
    shortDescription:
      "Design customer, professional, and staff referral systems with tracking and recognition.",
    description:
      "Referral Loop Agency installs referral growth systems across customers, professionals, and staff — including offers, follow-up campaigns, partner onboarding, assets, tracking, and reporting.",
    category: "Referrals",
    icon: "RL",
    accent: "#0D9488",
    sortOrder: 6,
    workflowTargetCount: 31,
    idealClient:
      "Businesses whose growth depends on customer and professional referrals.",
    problemsAddressed: [
      "Referrals happen ad hoc with no system",
      "No incentives, tracking, or recognition loop",
      "Staff and partners are not enabled to refer",
    ],
    valueProposition:
      "Build a closed-loop referral system for customers, professionals, and staff with measurable follow-up.",
    services: [
      "Referral Growth Audit",
      "Customer Referral Program",
      "Professional Referral Program",
      "Staff Referral Enablement",
      "Referral Offer and Incentive Design",
      "Referral Request and Follow-Up Campaigns",
      "Referral Partner Onboarding",
      "Referral Asset and Content Packs",
      "Referral Tracking and Recognition",
      "Referral Reporting and Optimization",
    ],
  },
  {
    name: "Repeat Revenue Agency",
    slug: "repeat-revenue-agency",
    tagline: "Retention, Rebooking & Customer Value",
    shortDescription:
      "Improve retention, rebooking, renewals, loyalty, and customer lifetime value.",
    description:
      "Repeat Revenue Agency focuses on retention and repeat revenue: rebooking, lifecycle communication, memberships, loyalty, churn reduction, value growth, and feedback loops.",
    category: "Retention",
    icon: "RR",
    accent: "#DB2777",
    sortOrder: 7,
    workflowTargetCount: 31,
    idealClient:
      "Businesses that grow by keeping customers longer and increasing lifetime value.",
    problemsAddressed: [
      "Weak rebooking and renewal systems",
      "Churn without early intervention",
      "No structured loyalty or lifecycle communication",
    ],
    valueProposition:
      "Install retention systems that drive rebooking, renewals, loyalty, and measurable customer value growth.",
    services: [
      "Retention and Repeat Revenue Audit",
      "Rebooking System",
      "Repeat Purchase Campaigns",
      "Renewal and Membership Retention",
      "Customer Lifecycle Communication",
      "Loyalty and Recognition Program",
      "Churn and Cancellation Reduction",
      "Customer Value Growth",
      "Customer Experience and Feedback Loop",
      "Retention Reporting and Optimization",
    ],
  },
  {
    name: "Revenue Revival Agency",
    slug: "revenue-revival-agency",
    tagline: "Lead, Estimate & Customer Reactivation",
    shortDescription:
      "Recover old leads, unclosed estimates, missed enquiries, and dormant customers.",
    description:
      "Revenue Revival Agency reactivates stranded revenue: old leads, unclosed estimates, missed enquiries, dormant customers, abandoned bookings, and seasonal revival campaigns — with human review before outreach.",
    category: "Reactivation",
    icon: "RV",
    accent: "#D97706",
    sortOrder: 8,
    workflowTargetCount: 29,
    idealClient:
      "Businesses sitting on old leads, estimates, and dormant customers that can be responsibly revived.",
    problemsAddressed: [
      "Stale CRM pipelines with no reactivation cadence",
      "Unclosed estimates and abandoned bookings",
      "Missed enquiries that never re-entered the funnel",
    ],
    valueProposition:
      "Recover stranded revenue through structured reactivation systems with human-approved outreach.",
    services: [
      "Revenue Opportunity Audit",
      "Old Lead Reactivation",
      "Unclosed Estimate Recovery",
      "Missed Enquiry Recovery",
      "Dormant Customer Win-Back",
      "Abandoned Booking Recovery",
      "Seasonal Revenue Revival",
      "Response & Booking Support",
      "Campaign Reporting & Optimization",
    ],
  },
  {
    name: "Trust Builder Agency",
    slug: "trust-builder-agency",
    tagline: "Reviews, Reputation & Customer Proof",
    shortDescription:
      "Build review systems, recovery processes, testimonials, and trust content programs.",
    description:
      "Trust Builder Agency is the reputation and social-proof operating system: review requests, feedback, responses, negative-review recovery, testimonials, case studies, amplification, and multi-location reputation programs.",
    category: "Reputation",
    icon: "TB",
    accent: "#0891B2",
    sortOrder: 9,
    workflowTargetCount: 30,
    idealClient:
      "Businesses where reviews, reputation, and customer proof drive purchase decisions.",
    problemsAddressed: [
      "Inconsistent review requests and responses",
      "No negative-review recovery process",
      "Weak testimonials and case-study capture",
    ],
    valueProposition:
      "Operate a trust system that systematically generates, manages, and amplifies customer proof.",
    services: [
      "Reputation and Trust Audit",
      "Review Request System",
      "Customer Feedback System",
      "Review Response Management",
      "Negative Review Recovery",
      "Review Monitoring and Reporting",
      "Testimonial Capture System",
      "Case Study and Success Story Creation",
      "Trust Content and Review Amplification",
      "Multi-Location Reputation Program",
    ],
  },
  {
    name: "Video Authority Agency",
    slug: "video-authority-agency",
    tagline: "Expert-Led Video Content Systems",
    shortDescription:
      "Plan and produce expert video systems for authority, education, and distribution.",
    description:
      "Video Authority Agency helps operators build expert-led video systems: audits, pillars, 90-day planning, short-form and long-form content, FAQs/explainers, customer stories, production briefs, repurposing, and reporting.",
    category: "Video Authority",
    icon: "VA",
    accent: "#4F46E5",
    sortOrder: 10,
    workflowTargetCount: 31,
    idealClient:
      "Experts and local businesses that want authority through structured video content systems.",
    problemsAddressed: [
      "No content pillars or 90-day video plan",
      "Inconsistent production briefs and distribution",
      "Videos that do not address FAQs, objections, or proof",
    ],
    valueProposition:
      "Build an expert video authority system from planning through production briefs, repurposing, and reporting.",
    services: [
      "Video Authority Audit",
      "Expert Positioning and Content Pillars",
      "90-Day Video Content Planning",
      "Short-Form Video Content",
      "Long-Form Educational Video",
      "FAQ, Objection and Service Explainer Videos",
      "Customer Story and Case Study Videos",
      "Recording, Production and Editing Briefs",
      "Video Repurposing and Distribution",
      "Video Reporting and Optimization",
    ],
  },
];

export function slugifyService(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function catalogStats() {
  const serviceCount = AGENCY_CATALOG.reduce((n, a) => n + a.services.length, 0);
  const workflowTargetTotal = AGENCY_CATALOG.reduce(
    (n, a) => n + a.workflowTargetCount,
    0
  );
  return {
    agencies: AGENCY_CATALOG.length,
    services: serviceCount,
    workflowTargetTotal,
  };
}

export function emptyAgencyBuilderConfig() {
  return {
    aiPlatform: null as string | null,
    agencyName: null as string | null,
    country: null as string | null,
    targetNiche: null as string | null,
    geographicServiceArea: null as string | null,
    experienceLevel: null as string | null,
    preferredDeliveryModel: null as string | null,
    weeklyTimeAvailability: null as string | null,
    monthlyIncomeOrClientTarget: null as string | null,
    selectedServiceIds: [] as string[],
  };
}

export function serviceDescription(agencyName: string, serviceName: string): string {
  return `${serviceName} is a selectable delivery service inside ${agencyName}. Stage 3A catalogs the service for packaging and selection; Stage 3B adds original AI Enterprise Studio guided workflows and operator playbooks.`;
}

export function buildResourceSlot(
  kind:
    | "OPERATOR_GUIDE"
    | "SALES_PAGE"
    | "SALES_COPY"
    | "POSITIONING"
    | "BUSINESS_STRATEGY",
  entry: AgencyCatalogEntry
) {
  const base = {
    status: "STRUCTURE_READY" as const,
    stage: "3A",
    version: 1,
    agency: entry.name,
    agencySlug: entry.slug,
    editable: true,
    principles: [...FAQ_PRINCIPLES],
    note: "Original AI Enterprise Studio content will be fully authored in Stage 3B. This Stage 3A slot defines the structure operators will use.",
  };

  switch (kind) {
    case "OPERATOR_GUIDE":
      return {
        ...base,
        title: `${entry.name} — Operator Guide`,
        sections: [
          "Agency overview",
          "Who this agency is for",
          "Daily / weekly operating cadence",
          "Service selection guidance",
          "Quality review checklist",
          "Client communication norms",
          "Escalation and permissions",
        ],
        body: null,
      };
    case "SALES_PAGE":
      return {
        ...base,
        title: `${entry.name} — Client Sales Page`,
        html: null,
        outline: [
          "Headline & promise",
          "Problem framing",
          "Solution overview",
          "Service highlights",
          "Delivery model",
          "Proof / trust cues",
          "CTA / contact block",
        ],
        cta: { label: null, contactEmail: null, contactUrl: null },
      };
    case "SALES_COPY":
      return {
        ...base,
        title: `${entry.name} — Sales Copy`,
        blocks: {
          elevatorPitch: entry.valueProposition,
          benefitBullets: entry.problemsAddressed.map(
            (p) => `Addresses: ${p}`
          ),
          serviceHighlights: entry.services.slice(0, 5),
          objectionHandlers: [],
          emailSnippets: [],
        },
      };
    case "POSITIONING":
      return {
        ...base,
        title: `${entry.name} — Positioning`,
        positioning: {
          tagline: entry.tagline,
          idealClient: entry.idealClient,
          problemsAddressed: entry.problemsAddressed,
          valueProposition: entry.valueProposition,
          commercialAngles: [
            "Operating system, not one-off deliverables",
            "Human-approved implementation",
            "Selectable services packaged to client needs",
          ],
          differentiator:
            "Structured agency operations inside AI Enterprise Studio — choose one agency model or combine later via bundles.",
        },
      };
    case "BUSINESS_STRATEGY":
      return {
        ...base,
        title: `${entry.name} — Agency Business Strategy`,
        strategy: {
          idealClient: entry.idealClient,
          problemsAddressed: entry.problemsAddressed,
          valueProposition: entry.valueProposition,
          servicePackaging:
            "Package audits first, then install core systems, then reporting/optimization retainers.",
          deliveryModel:
            "Human-led research, client approval, implementation support, and quality review. No autonomous client-account actions.",
          workflowOverview: {
            targetCount: entry.workflowTargetCount,
            definedInStage3A: 0,
            note: "Original AES guided workflows are authored in Stage 3B against this target architecture.",
          },
          clientCommunicationApproach:
            "Clear scopes, permission checkpoints, and written recommendations before any client-facing change.",
          retentionOpportunities: [
            "Monthly optimization reporting",
            "Additional service activation from the catalog",
            "Cross-agency expansion when the client is ready",
          ],
        },
      };
  }
}
