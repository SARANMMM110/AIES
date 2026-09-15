export type AgencySalesCopy = {
  slug: string;
  eyebrow: string;
  headline: string;
  /** Accent-colored trailing phrase in the hero headline */
  headlineAccent?: string;
  subheadline: string;
  heroPills?: string[];
  challengeTitle?: string;
  challengeLead?: string;
  heroVisual: "network" | "funnel" | "campaign" | "partners" | "map" | "loop" | "lifecycle" | "revival" | "trust" | "video";
  howSteps: Array<{ title: string; body: string }>;
  benefits: Array<{ title: string; body: string }>;
  whoFor: string[];
  outcomes: string[];
  faqs: Array<{ q: string; a: string }>;
  finalHeadline: string;
};

export const AGENCY_SALES_COPY: Record<string, AgencySalesCopy> = {
  "ai-advantage-agency": {
    slug: "ai-advantage-agency",
    eyebrow: "AI ADVANTAGE AGENCY",
    headline: "Build a Smarter, More Efficient",
    headlineAccent: "Business with AI.",
    subheadline:
      "AI Advantage Agency helps operators audit readiness, map work, prioritize use cases, and deliver prompts, SOPs, and governance — with human review before anything reaches a client.",
    heroPills: ["Practical & Actionable", "Guided Workflows", "Real Business Applications"],
    challengeTitle: "Great businesses can still do better.",
    challengeLead:
      "Most teams already know AI matters. The gap is a clear operating system — priorities, workflows, and human review — so opportunity turns into consistent delivery.",
    heroVisual: "network",
    howSteps: [
      { title: "Assess", body: "Understand readiness, risks, and opportunity signals." },
      { title: "Identify", body: "Prioritize use cases that fit the business and team." },
      { title: "Design", body: "Shape enablement systems, roles, and quality controls." },
      { title: "Implement", body: "Produce prompts, SOPs, and playbooks operators can run." },
      { title: "Measure", body: "Report outcomes and refine the next operating cycle." },
    ],
    benefits: [
      { title: "Governed AI adoption", body: "Keep humans in the loop for quality and risk." },
      { title: "Clear opportunity focus", body: "Prioritize use cases instead of scattered experiments." },
      { title: "Reusable prompt systems", body: "Turn one-off chats into structured SOP libraries." },
      { title: "Operator-ready workflows", body: "Guided steps from inputs to reviewed deliverables." },
      { title: "Cross-function coverage", body: "Marketing, communication, ops, knowledge, and reporting." },
      { title: "Client-safe delivery", body: "No autonomous publish, contact, or account changes." },
    ],
    whoFor: [
      "Service Businesses",
      "Professional Firms",
      "Growing Companies",
      "Multi-Location Operators",
      "Internal Teams",
    ],
    outcomes: [
      "Designed to help teams adopt AI with clearer readiness and priorities",
      "Make it easier to produce consistent prompts, SOPs, and handoffs",
      "Build a repeatable enablement delivery system under human review",
    ],
    faqs: [
      {
        q: "What is AI Advantage Agency?",
        a: "An AI Enterprise Studio product for AI enablement and workflow consulting — audits, roadmaps, SOPs, and governance with human approval.",
      },
      {
        q: "Who is it for?",
        a: "Operators and agencies serving businesses that want practical AI systems without unsupervised automation.",
      },
      {
        q: "Does it automatically change client systems?",
        a: "No. It produces guided plans and deliverables. External changes require human approval and client permission.",
      },
    ],
    finalHeadline: "Ready to deliver governed AI enablement with confidence?",
  },
  "booking-flow-agency": {
    slug: "booking-flow-agency",
    eyebrow: "AI-POWERED LEAD CONVERSION",
    headline: "Turn enquiries into booked appointments with a repeatable system.",
    subheadline:
      "Booking Flow Agency equips operators to audit lead handling, design response and qualification systems, and implement follow-up, booking, and no-show recovery — reviewed by humans before use.",
    heroVisual: "funnel",
    howSteps: [
      { title: "Audit", body: "Map enquiry channels, timing gaps, and drop-offs." },
      { title: "Design", body: "Define scripts, qualification rules, and booking paths." },
      { title: "Operate", body: "Produce playbooks for response, reminders, and recovery." },
      { title: "Review", body: "Approve messaging before client-facing use." },
      { title: "Measure", body: "Track conversion visibility and improve the next cycle." },
    ],
    benefits: [
      { title: "Faster lead response", body: "Structure how teams answer and follow up." },
      { title: "Clear qualification", body: "Separate ready-to-book leads from noise." },
      { title: "Multi-channel follow-up", body: "Keep sequences consistent across channels." },
      { title: "Booking support", body: "Guide appointments and estimate requests." },
      { title: "No-show recovery", body: "Plan confirmations, reminders, and recovery steps." },
      { title: "Conversion visibility", body: "Report what moved and what stalled." },
    ],
    whoFor: [
      "Local service businesses living on appointments",
      "Agencies selling lead-to-booking systems",
      "Teams with missed calls and slow follow-up",
    ],
    outcomes: [
      "Designed to help create more consistent enquiry handling",
      "Make it easier to recover missed opportunities",
      "Build a repeatable path from lead to booked appointment",
    ],
    faqs: [
      {
        q: "What is Booking Flow Agency?",
        a: "A lead-to-appointment operating system inside AI Enterprise Studio focused on enquiry handling, qualification, booking, and recovery workflows.",
      },
      {
        q: "Can I buy only this agency?",
        a: "Yes. Purchase Booking Flow Agency individually, or choose the Complete Suite for all ten agencies.",
      },
      {
        q: "Does it send SMS or emails automatically?",
        a: "No. It helps you design and review systems. Sending remains a human/client-approved action outside autonomous execution.",
      },
    ],
    finalHeadline: "Ready to make enquiry-to-booking more consistent?",
  },
  "demand-builder-agency": {
    slug: "demand-builder-agency",
    eyebrow: "AI-POWERED DEMAND GENERATION",
    headline: "Fill capacity with planned campaigns — not last-minute scramble.",
    subheadline:
      "Demand Builder Agency helps operators audit demand gaps, design offers and campaign systems, and produce launch-ready plans with human review before anything is published.",
    heroVisual: "campaign",
    howSteps: [
      { title: "Audit", body: "Find capacity gaps and weak promotional patterns." },
      { title: "Plan", body: "Shape calendars, offers, and campaign concepts." },
      { title: "Create", body: "Produce asset briefs and launch plans." },
      { title: "Review", body: "Approve offers and claims before publish." },
      { title: "Optimize", body: "Measure results and refine the next campaign cycle." },
    ],
    benefits: [
      { title: "Promotional calendars", body: "Plan demand across seasons and quiet periods." },
      { title: "Offer clarity", body: "Define promotions that match capacity and brand." },
      { title: "Campaign structure", body: "Audience, message, channel, and ownership in one system." },
      { title: "Launch readiness", body: "Asset packs and go-live checklists for operators." },
      { title: "Local relevance", body: "Support community and event-driven campaigns." },
      { title: "Measured improvement", body: "Review what filled capacity and what did not." },
    ],
    whoFor: [
      "Businesses with spare capacity to fill",
      "Agencies offering campaign and promotion systems",
      "Operators who need seasonal and local demand planning",
    ],
    outcomes: [
      "Designed to help fill capacity with more deliberate campaign planning",
      "Make it easier to produce consistent offers and launch assets",
      "Build a repeatable promotions operating rhythm",
    ],
    faqs: [
      {
        q: "What is Demand Builder Agency?",
        a: "An AI Enterprise Studio product for promotions, campaign planning, offers, launches, and demand reporting — with human approval before publish.",
      },
      {
        q: "Does it launch ads automatically?",
        a: "No. It creates plans and assets for human review. Ad platforms and publishing stay outside autonomous execution.",
      },
      {
        q: "Can I upgrade later?",
        a: "Yes. Start with this agency, then explore the Complete Suite when you want all ten systems.",
      },
    ],
    finalHeadline: "Ready to plan demand instead of reacting to quiet weeks?",
  },
  "local-alliance-agency": {
    slug: "local-alliance-agency",
    eyebrow: "AI-POWERED PARTNERSHIPS",
    headline: "Grow through structured local partnerships and co-marketing.",
    subheadline:
      "Local Alliance Agency helps operators map partners, design joint offers, and run onboarding and governance systems — without one-off collaborations that fade.",
    heroVisual: "partners",
    howSteps: [
      { title: "Map", body: "Identify complementary partners and opportunities." },
      { title: "Design", body: "Shape joint offers and co-marketing roles." },
      { title: "Onboard", body: "Produce governance and partner enablement plans." },
      { title: "Review", body: "Approve outreach and offers before contact." },
      { title: "Sustain", body: "Track relationship health and next collaboration cycles." },
    ],
    benefits: [
      { title: "Partner clarity", body: "Know who fits and why before outreach." },
      { title: "Joint offer systems", body: "Design collaborations with clear ownership." },
      { title: "Co-marketing rhythm", body: "Move beyond one-off events." },
      { title: "Governance", body: "Define permissions, messaging, and handoffs." },
      { title: "Community leverage", body: "Support sponsorships and local alliances." },
      { title: "Repeatable outreach", body: "Operator playbooks instead of ad-hoc emails." },
    ],
    whoFor: [
      "Local businesses that grow through complementary partners",
      "Agencies packaging partnership systems",
      "Operators managing community and co-marketing programs",
    ],
    outcomes: [
      "Designed to help build more intentional partner pipelines",
      "Make it easier to structure joint offers and co-marketing",
      "Create a repeatable alliance operating system",
    ],
    faqs: [
      {
        q: "What is Local Alliance Agency?",
        a: "A partnerships and co-marketing operating system inside AI Enterprise Studio for partner mapping, joint offers, events, and governance.",
      },
      {
        q: "Does it contact partners automatically?",
        a: "No. Outreach drafts and plans require human review and permission before any contact.",
      },
      {
        q: "Is this separate from Local Presence?",
        a: "Yes. Local Alliance focuses on partnerships; Local Presence focuses on listings and profile systems.",
      },
    ],
    finalHeadline: "Ready to turn partnerships into a managed growth system?",
  },
  "local-presence-agency": {
    slug: "local-presence-agency",
    eyebrow: "AI-POWERED LOCAL VISIBILITY",
    headline: "Make local profiles consistent, complete, and operable.",
    subheadline:
      "Local Presence Agency helps operators audit listings, design optimization plans, and install operating cadences for profiles, posts, photos, and Q&A — with human review before changes.",
    heroVisual: "map",
    howSteps: [
      { title: "Audit", body: "Find inconsistencies across listings and profiles." },
      { title: "Plan", body: "Prioritize fixes for categories, media, and content." },
      { title: "Operate", body: "Set cadence for posts, updates, and reviews of accuracy." },
      { title: "Review", body: "Approve changes before profile updates." },
      { title: "Maintain", body: "Keep multi-location presence coherent over time." },
    ],
    benefits: [
      { title: "Listing consistency", body: "Reduce NAP and category drift across platforms." },
      { title: "Profile completeness", body: "Structure services, photos, posts, and Q&A." },
      { title: "Multi-location clarity", body: "Coordinate presence across sites." },
      { title: "Operating cadence", body: "Give teams a repeatable update rhythm." },
      { title: "Optimization focus", body: "Fix the highest-impact gaps first." },
      { title: "Human-controlled changes", body: "No unsupervised profile edits." },
    ],
    whoFor: [
      "Local and multi-location businesses",
      "Agencies managing listings and local profiles",
      "Operators who need presence systems, not one-time cleanups",
    ],
    outcomes: [
      "Designed to help create more consistent local profile systems",
      "Make it easier to maintain listings and content cadence",
      "Build a repeatable local presence operating model",
    ],
    faqs: [
      {
        q: "What is Local Presence Agency?",
        a: "An AI Enterprise Studio product for local profile audits, optimization planning, and operating cadence across listings and presence assets.",
      },
      {
        q: "Does it edit Google Business profiles automatically?",
        a: "No. It produces plans and checklists. Profile changes require human action and client permission.",
      },
      {
        q: "How many workflows are included?",
        a: "Workflow counts come from the live catalog for this agency and are shown on the sales page.",
      },
    ],
    finalHeadline: "Ready to make local presence an operating system?",
  },
  "referral-loop-agency": {
    slug: "referral-loop-agency",
    eyebrow: "AI-POWERED REFERRALS",
    headline: "Design referral systems people can actually run.",
    subheadline:
      "Referral Loop Agency helps operators audit referral gaps, design programs and incentives, and enable tracking and recognition — with compliance-minded human review.",
    heroVisual: "loop",
    howSteps: [
      { title: "Audit", body: "Map customer, professional, and staff referral paths." },
      { title: "Design", body: "Define asks, incentives, and tracking structure." },
      { title: "Enable", body: "Produce assets and operator playbooks." },
      { title: "Review", body: "Approve incentive and messaging for compliance." },
      { title: "Recognize", body: "Close the loop with tracking and appreciation." },
    ],
    benefits: [
      { title: "Multi-source referrals", body: "Customers, professionals, and staff in one system." },
      { title: "Ask moments", body: "Know when and how to request introductions." },
      { title: "Incentive clarity", body: "Design rewards that fit policy and brand." },
      { title: "Tracking readiness", body: "Reduce lost referrals with clearer ownership." },
      { title: "Enablement assets", body: "Scripts, templates, and partner materials." },
      { title: "Recognition loops", body: "Sustain programs beyond the first launch." },
    ],
    whoFor: [
      "Businesses that grow through introductions",
      "Professional firms and service providers",
      "Agencies packaging referral operating systems",
    ],
    outcomes: [
      "Designed to help create more consistent referral asks and follow-through",
      "Make it easier to track and recognize referral partners",
      "Build a repeatable referral loop under human oversight",
    ],
    faqs: [
      {
        q: "What is Referral Loop Agency?",
        a: "An AI Enterprise Studio product for referral audits, program design, enablement, tracking, and recognition systems.",
      },
      {
        q: "Does it send referral requests automatically?",
        a: "No. It helps design and review the system. Sending remains a human-approved action.",
      },
      {
        q: "Can I buy this alone?",
        a: "Yes — purchase individually or as part of the Complete Suite.",
      },
    ],
    finalHeadline: "Ready to turn referrals into a managed growth loop?",
  },
  "repeat-revenue-agency": {
    slug: "repeat-revenue-agency",
    eyebrow: "AI-POWERED RETENTION",
    headline: "Improve rebooking, renewals, and customer lifetime value systems.",
    subheadline:
      "Repeat Revenue Agency helps operators audit retention gaps, design lifecycle systems, and implement playbooks for rebooking, memberships, and loyalty — with human review before outreach.",
    heroVisual: "lifecycle",
    howSteps: [
      { title: "Audit", body: "Find churn risks and weak rebooking moments." },
      { title: "Design", body: "Shape lifecycle triggers, offers, and ownership." },
      { title: "Activate", body: "Produce playbooks for retention and renewals." },
      { title: "Review", body: "Approve customer communication before send." },
      { title: "Improve", body: "Measure retention signals and refine the cycle." },
    ],
    benefits: [
      { title: "Rebooking systems", body: "Structure the next appointment or purchase ask." },
      { title: "Lifecycle clarity", body: "Know which customers need which next step." },
      { title: "Membership support", body: "Plan renewals and retention offers carefully." },
      { title: "Loyalty rhythm", body: "Design recognition without empty promises." },
      { title: "Feedback loops", body: "Capture insight that improves retention design." },
      { title: "Operator ownership", body: "Clear roles for retention actions." },
    ],
    whoFor: [
      "Businesses that depend on repeat purchases or rebooking",
      "Agencies offering retention and loyalty systems",
      "Operators managing memberships and renewals",
    ],
    outcomes: [
      "Designed to help create more consistent retention and rebooking systems",
      "Make it easier to manage lifecycle communication with review",
      "Build a repeatable approach to customer value over time",
    ],
    faqs: [
      {
        q: "What is Repeat Revenue Agency?",
        a: "An AI Enterprise Studio product focused on retention, rebooking, renewals, loyalty, and lifecycle communication systems.",
      },
      {
        q: "Does it guarantee higher LTV?",
        a: "No. It helps you design and operate retention systems. Results depend on execution and market conditions.",
      },
      {
        q: "Is outreach automated?",
        a: "No autonomous client contact. Human approval remains required.",
      },
    ],
    finalHeadline: "Ready to make retention a managed operating system?",
  },
  "revenue-revival-agency": {
    slug: "revenue-revival-agency",
    eyebrow: "AI-POWERED REACTIVATION",
    headline: "Recover dormant demand with structured revival campaigns.",
    subheadline:
      "Revenue Revival Agency helps operators audit old leads and dormant customers, design reactivation campaigns, and support response/booking follow-through — with human review before contact.",
    heroVisual: "revival",
    howSteps: [
      { title: "Audit", body: "Identify dormant lists and unclosed opportunities." },
      { title: "Segment", body: "Design reactivation priorities and offers." },
      { title: "Campaign", body: "Produce sequences and response-support plans." },
      { title: "Review", body: "Approve tone, claims, and compliance before outreach." },
      { title: "Convert", body: "Support booking/response handoffs for operators." },
    ],
    benefits: [
      { title: "Dormant list clarity", body: "Know what is worth reviving and why." },
      { title: "Reactivation design", body: "Segmented campaigns instead of blast-and-hope." },
      { title: "Offer discipline", body: "Match revival offers to risk and brand." },
      { title: "Response support", body: "Help teams handle replies and bookings." },
      { title: "Compliance awareness", body: "Review before contacting old leads." },
      { title: "Cycle reporting", body: "Learn what revived and what should stop." },
    ],
    whoFor: [
      "Businesses sitting on old leads and unclosed estimates",
      "Agencies offering reactivation programs",
      "Operators who need structured revival without spammy automation",
    ],
    outcomes: [
      "Designed to help recover dormant opportunities more deliberately",
      "Make it easier to run reactivation campaigns with human gates",
      "Build a repeatable revival system for old demand",
    ],
    faqs: [
      {
        q: "What is Revenue Revival Agency?",
        a: "An AI Enterprise Studio product for reactivating old leads, unclosed estimates, missed enquiries, and dormant customers.",
      },
      {
        q: "Does it email old lists automatically?",
        a: "No. It creates campaign plans for human review. Contact requires permission and compliance checks.",
      },
      {
        q: "Can I buy it alone?",
        a: "Yes. Purchase individually or unlock it with the Complete Suite.",
      },
    ],
    finalHeadline: "Ready to revive dormant demand with a controlled system?",
  },
  "trust-builder-agency": {
    slug: "trust-builder-agency",
    eyebrow: "AI-POWERED REPUTATION",
    headline: "Build review, recovery, and trust-content systems that hold up.",
    subheadline:
      "Trust Builder Agency helps operators audit reputation, design trust systems, and amplify proof through testimonials and case studies — with careful human review for every public response.",
    heroVisual: "trust",
    howSteps: [
      { title: "Audit", body: "Assess review health and feedback gaps." },
      { title: "Design", body: "Shape monitoring, response, and recovery systems." },
      { title: "Prove", body: "Plan testimonials, case studies, and trust content." },
      { title: "Review", body: "Approve public replies before they go live." },
      { title: "Amplify", body: "Distribute proof assets with operator control." },
    ],
    benefits: [
      { title: "Reputation visibility", body: "Know where trust is strong or fragile." },
      { title: "Response systems", body: "Consistent review reply frameworks." },
      { title: "Negative-review recovery", body: "Structured escalation and recovery paths." },
      { title: "Proof assets", body: "Testimonials and case studies with approval gates." },
      { title: "Multi-location support", body: "Coordinate reputation across sites." },
      { title: "Brand-safe publishing", body: "No unsupervised public replies." },
    ],
    whoFor: [
      "Local and multi-location brands protecting reputation",
      "Agencies offering review and trust programs",
      "Operators who need recovery systems, not generic templates",
    ],
    outcomes: [
      "Designed to help create more consistent reputation operations",
      "Make it easier to recover from negative feedback with process",
      "Build a repeatable trust and proof-content system",
    ],
    faqs: [
      {
        q: "What is Trust Builder Agency?",
        a: "An AI Enterprise Studio product for reputation audits, review systems, recovery, testimonials, and trust content programs.",
      },
      {
        q: "Does it post review responses automatically?",
        a: "No. Responses are drafted for human review. Publishing requires approval.",
      },
      {
        q: "Is this the same as Local Presence?",
        a: "No. Trust Builder focuses on reputation and proof; Local Presence focuses on listings and profile systems.",
      },
    ],
    finalHeadline: "Ready to operate trust and reputation with clearer systems?",
  },
  "video-authority-agency": {
    slug: "video-authority-agency",
    eyebrow: "AI-POWERED VIDEO AUTHORITY",
    headline: "Turn expertise into a structured video authority system.",
    subheadline:
      "Video Authority Agency helps operators audit content gaps, design pillars and production systems, and plan distribution — with human review before publish.",
    heroVisual: "video",
    howSteps: [
      { title: "Audit", body: "Map expertise, audience needs, and content gaps." },
      { title: "Design", body: "Define pillars, formats, and production systems." },
      { title: "Produce", body: "Create briefs and distribution plans." },
      { title: "Review", body: "Approve claims and brand before publishing." },
      { title: "Distribute", body: "Repurpose and schedule with operator control." },
    ],
    benefits: [
      { title: "Content pillars", body: "Clear themes instead of random videos." },
      { title: "Production briefs", body: "Operator-ready plans for short and long form." },
      { title: "Authority positioning", body: "Connect expertise to audience questions." },
      { title: "Repurposing systems", body: "Extend one idea across formats." },
      { title: "Distribution clarity", body: "Know where content goes and who owns it." },
      { title: "Human editorial control", body: "No unsupervised publishing." },
    ],
    whoFor: [
      "Experts and firms building authority through video",
      "Agencies packaging video content systems",
      "Operators who need production and distribution structure",
    ],
    outcomes: [
      "Designed to help create more consistent expert video systems",
      "Make it easier to plan, brief, and distribute content",
      "Build a repeatable video authority operating model",
    ],
    faqs: [
      {
        q: "What is Video Authority Agency?",
        a: "An AI Enterprise Studio product for expert video systems — pillars, planning, production briefs, repurposing, and distribution workflows.",
      },
      {
        q: "Does it upload videos automatically?",
        a: "No. It produces plans and briefs. Publishing remains a human-controlled step.",
      },
      {
        q: "Can I purchase only this agency?",
        a: "Yes, or choose the Complete Suite for all ten agencies.",
      },
    ],
    finalHeadline: "Ready to turn expertise into a managed video authority system?",
  },
};

export function getAgencySalesCopy(slug: string): AgencySalesCopy | null {
  return AGENCY_SALES_COPY[slug] ?? null;
}
