/**
 * Stage 3B — Original AI Enterprise Studio guided workflow definitions.
 *
 * Content organization:
 * - agency-catalog.ts     → agencies + services (source of truth)
 * - workflow-catalog.ts   → generates distinct AES workflows per service
 * - resource-content.ts   → Operator Guides, Strategy, Sales Pages, Copy
 *
 * These are ORIGINAL AES workflows based on approved concepts — not vendor imports.
 */

import type { AgencyCatalogEntry } from "./agency-catalog";
import { slugifyService } from "./agency-catalog";

export type WorkflowInputField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};

export type WorkflowSpec = {
  key: string;
  name: string;
  description: string;
  purpose: string;
  serviceName: string;
  displayOrder: number;
  inputs: WorkflowInputField[];
  aiInstructionTemplate: string;
  outputDefinition: {
    deliverableType: string;
    sections: string[];
  };
  reviewRequirements: {
    checklist: string[];
    autonomousActionsForbidden: true;
  };
  nextAction: string;
  steps: Array<{ id: number; name: string; instruction: string }>;
};

type Phase = {
  suffix: string;
  nameSuffix: string;
  purposeVerb: string;
  deliverableType: string;
  processFocus: string;
  outputSections: string[];
  nextAction: string;
};

/** Base phases — customized per agency family for distinct purposes. */
function phasesForAgency(entry: AgencyCatalogEntry): Phase[] {
  const cat = entry.category;
  if (cat === "AI Enablement") {
    return [
      {
        suffix: "readiness-assessment",
        nameSuffix: "Readiness Assessment",
        purposeVerb: "Assess current state and readiness gaps",
        deliverableType: "Readiness assessment report",
        processFocus: "audit current tools, skills, risks, and opportunity signals",
        outputSections: [
          "Current-state summary",
          "Readiness scorecard",
          "Risks and constraints",
          "Priority opportunities",
          "Recommended next step",
        ],
        nextAction: "Proceed to system design for the highest-priority opportunity.",
      },
      {
        suffix: "system-design",
        nameSuffix: "System Design",
        purposeVerb: "Design a practical enablement system",
        deliverableType: "Enablement system design",
        processFocus: "define workflows, prompts, roles, and quality controls",
        outputSections: [
          "System overview",
          "Roles and ownership",
          "Prompt / SOP outline",
          "Quality-control checkpoints",
          "Implementation sequence",
        ],
        nextAction: "Build the implementation playbook and client approval pack.",
      },
      {
        suffix: "implementation-playbook",
        nameSuffix: "Implementation Playbook",
        purposeVerb: "Produce an actionable implementation plan",
        deliverableType: "Implementation playbook",
        processFocus: "create step-by-step enablement actions with human approval gates",
        outputSections: [
          "Implementation steps",
          "Required inputs and permissions",
          "Training / handoff notes",
          "Success metrics",
          "30-day follow-up plan",
        ],
        nextAction: "Run a reporting and optimization review after first cycle.",
      },
    ];
  }
  if (cat === "Lead Conversion") {
    return [
      {
        suffix: "process-audit",
        nameSuffix: "Process Audit",
        purposeVerb: "Audit how leads currently move from enquiry to booking",
        deliverableType: "Lead-process audit",
        processFocus: "map enquiry channels, response times, drop-offs, and conversion leaks",
        outputSections: [
          "Channel map",
          "Response-time findings",
          "Drop-off analysis",
          "Quick wins",
          "Priority fixes",
        ],
        nextAction: "Design the response / conversion system for the biggest leak.",
      },
      {
        suffix: "conversion-system-design",
        nameSuffix: "Conversion System Design",
        purposeVerb: "Design the booking conversion system for this service area",
        deliverableType: "Conversion system design",
        processFocus: "define scripts, sequencing, qualification rules, and booking paths",
        outputSections: [
          "System blueprint",
          "Scripts and templates outline",
          "Qualification rules",
          "Channel sequence",
          "Owner responsibilities",
        ],
        nextAction: "Create the operator playbook and test with a sample lead.",
      },
      {
        suffix: "operator-playbook",
        nameSuffix: "Operator Playbook",
        purposeVerb: "Create a day-to-day playbook operators can run",
        deliverableType: "Operator playbook",
        processFocus: "produce checklists, scripts, escalation paths, and review gates",
        outputSections: [
          "Daily checklist",
          "Scripts / response pack",
          "Escalation rules",
          "Human review gates",
          "KPI tracking sheet outline",
        ],
        nextAction: "Measure conversion and open the reporting workflow.",
      },
    ];
  }
  if (cat === "Demand Generation") {
    return [
      {
        suffix: "demand-audit",
        nameSuffix: "Demand Audit",
        purposeVerb: "Diagnose demand gaps and promotion opportunities",
        deliverableType: "Demand audit",
        processFocus: "review capacity, seasonality, offers, and campaign history",
        outputSections: [
          "Capacity vs demand snapshot",
          "Seasonality notes",
          "Offer gaps",
          "Campaign opportunities",
          "Priority recommendations",
        ],
        nextAction: "Design the campaign concept and offer package.",
      },
      {
        suffix: "campaign-design",
        nameSuffix: "Campaign & Offer Design",
        purposeVerb: "Design a campaign concept and offer package",
        deliverableType: "Campaign design pack",
        processFocus: "define audience, offer, channels, assets, and timeline",
        outputSections: [
          "Campaign concept",
          "Offer framing",
          "Channel plan",
          "Asset checklist",
          "Timeline and owners",
        ],
        nextAction: "Build the multi-channel asset brief and launch checklist.",
      },
      {
        suffix: "asset-and-launch",
        nameSuffix: "Asset Brief & Launch Plan",
        purposeVerb: "Produce asset briefs and a controlled launch plan",
        deliverableType: "Launch plan",
        processFocus: "specify assets, approvals, schedule, and measurement",
        outputSections: [
          "Asset briefs",
          "Approval checklist",
          "Launch schedule",
          "Measurement plan",
          "Post-launch review agenda",
        ],
        nextAction: "Run campaign reporting after the first measurement window.",
      },
    ];
  }
  if (cat === "Partnerships") {
    return [
      {
        suffix: "partner-opportunity-map",
        nameSuffix: "Opportunity Mapping",
        purposeVerb: "Identify and score partnership opportunities",
        deliverableType: "Partner opportunity map",
        processFocus: "map complementary partners, fit criteria, and outreach priority",
        outputSections: [
          "Ideal partner profile",
          "Opportunity shortlist",
          "Fit scoring",
          "Outreach priority order",
          "Risks / conflicts",
        ],
        nextAction: "Draft outreach and joint-offer concepts for top partners.",
      },
      {
        suffix: "joint-offer-design",
        nameSuffix: "Joint Offer Design",
        purposeVerb: "Design a joint offer or co-marketing package",
        deliverableType: "Joint offer brief",
        processFocus: "define shared value, offer mechanics, responsibilities, and success metrics",
        outputSections: [
          "Shared value proposition",
          "Offer mechanics",
          "Roles and responsibilities",
          "Go-to-market outline",
          "Success metrics",
        ],
        nextAction: "Create partner onboarding and governance checklist.",
      },
      {
        suffix: "partner-onboarding",
        nameSuffix: "Onboarding & Governance",
        purposeVerb: "Create partner onboarding and governance materials",
        deliverableType: "Partner onboarding pack",
        processFocus: "define onboarding steps, communication cadence, and reporting",
        outputSections: [
          "Onboarding checklist",
          "Communication cadence",
          "Brand / permission rules",
          "Shared reporting outline",
          "Exit / review terms notes",
        ],
        nextAction: "Track partnership results in the reporting workflow.",
      },
    ];
  }
  if (cat === "Local Visibility") {
    return [
      {
        suffix: "presence-audit",
        nameSuffix: "Presence Audit",
        purposeVerb: "Audit local profile and listing consistency",
        deliverableType: "Local presence audit",
        processFocus: "review NAP consistency, categories, visuals, posts, and Q&A gaps",
        outputSections: [
          "Profile findings",
          "Listing consistency issues",
          "Visual / category gaps",
          "Posting cadence gaps",
          "Priority remediation list",
        ],
        nextAction: "Build the optimization plan for critical profile fixes.",
      },
      {
        suffix: "optimization-plan",
        nameSuffix: "Optimization Plan",
        purposeVerb: "Create an optimization plan for profiles and listings",
        deliverableType: "Presence optimization plan",
        processFocus: "specify updates for categories, services, photos, posts, and Q&A",
        outputSections: [
          "Change list",
          "Content requirements",
          "Photo / visual brief",
          "Posting calendar outline",
          "Approval requirements",
        ],
        nextAction: "Produce the weekly operating checklist for presence maintenance.",
      },
      {
        suffix: "operating-cadence",
        nameSuffix: "Operating Cadence",
        purposeVerb: "Define the ongoing presence operating cadence",
        deliverableType: "Presence operating cadence",
        processFocus: "set weekly tasks, owners, review gates, and reporting",
        outputSections: [
          "Weekly task list",
          "Owner assignments",
          "Review gates",
          "Multi-location notes",
          "KPI dashboard outline",
        ],
        nextAction: "Run presence reporting after the first operating cycle.",
      },
    ];
  }
  if (cat === "Referrals") {
    return [
      {
        suffix: "referral-audit",
        nameSuffix: "Referral Audit",
        purposeVerb: "Audit current referral sources and gaps",
        deliverableType: "Referral growth audit",
        processFocus: "map customer, professional, and staff referral activity",
        outputSections: [
          "Current referral sources",
          "Volume and quality findings",
          "Incentive gaps",
          "Process gaps",
          "Priority opportunities",
        ],
        nextAction: "Design the referral program for the highest-potential source.",
      },
      {
        suffix: "program-design",
        nameSuffix: "Program Design",
        purposeVerb: "Design a referral program with incentives and requests",
        deliverableType: "Referral program design",
        processFocus: "define offers, request triggers, scripts, and tracking",
        outputSections: [
          "Program overview",
          "Incentive structure",
          "Request triggers",
          "Scripts / assets outline",
          "Tracking approach",
        ],
        nextAction: "Build partner/staff enablement assets and launch checklist.",
      },
      {
        suffix: "enablement-and-tracking",
        nameSuffix: "Enablement & Tracking",
        purposeVerb: "Create enablement assets and a tracking loop",
        deliverableType: "Referral enablement pack",
        processFocus: "produce assets, recognition ideas, and measurement cadence",
        outputSections: [
          "Enablement assets checklist",
          "Recognition plan",
          "Tracking sheet outline",
          "Launch checklist",
          "Review cadence",
        ],
        nextAction: "Measure referral performance and optimize monthly.",
      },
    ];
  }
  if (cat === "Retention") {
    return [
      {
        suffix: "retention-audit",
        nameSuffix: "Retention Audit",
        purposeVerb: "Audit retention leaks and repeat-revenue opportunities",
        deliverableType: "Retention audit",
        processFocus: "review rebooking, renewals, churn signals, and lifecycle gaps",
        outputSections: [
          "Retention baseline",
          "Churn risk signals",
          "Rebooking gaps",
          "Lifecycle communication gaps",
          "Priority interventions",
        ],
        nextAction: "Design the rebooking or lifecycle system for the biggest leak.",
      },
      {
        suffix: "retention-system-design",
        nameSuffix: "Retention System Design",
        purposeVerb: "Design a retention / rebooking system",
        deliverableType: "Retention system design",
        processFocus: "define triggers, messages, offers, and ownership",
        outputSections: [
          "System blueprint",
          "Trigger map",
          "Message / offer outline",
          "Owner responsibilities",
          "Success metrics",
        ],
        nextAction: "Build the operator playbook and first lifecycle sequence.",
      },
      {
        suffix: "lifecycle-playbook",
        nameSuffix: "Lifecycle Playbook",
        purposeVerb: "Create the lifecycle communication playbook",
        deliverableType: "Lifecycle playbook",
        processFocus: "produce sequences, checklists, and review gates",
        outputSections: [
          "Sequence outline",
          "Message drafts outline",
          "Checklist",
          "Human review gates",
          "Reporting cadence",
        ],
        nextAction: "Track retention KPIs and refine monthly.",
      },
    ];
  }
  if (cat === "Reactivation") {
    return [
      {
        suffix: "opportunity-audit",
        nameSuffix: "Opportunity Audit",
        purposeVerb: "Find stranded revenue opportunities in leads and customers",
        deliverableType: "Revenue opportunity audit",
        processFocus: "segment old leads, estimates, missed enquiries, and dormant customers",
        outputSections: [
          "Opportunity segments",
          "Estimated recovery potential notes",
          "Data quality issues",
          "Priority segments",
          "Recommended approach",
        ],
        nextAction: "Design a reactivation campaign for the top segment.",
      },
      {
        suffix: "reactivation-campaign",
        nameSuffix: "Reactivation Campaign Design",
        purposeVerb: "Design a responsible reactivation campaign",
        deliverableType: "Reactivation campaign plan",
        processFocus: "define segments, offers, scripts, cadence, and permission rules",
        outputSections: [
          "Segment definition",
          "Offer / angle",
          "Cadence plan",
          "Script outline",
          "Permission and compliance notes",
        ],
        nextAction: "Build response/booking support pack for replies.",
      },
      {
        suffix: "response-support",
        nameSuffix: "Response & Booking Support",
        purposeVerb: "Prepare response and booking support materials",
        deliverableType: "Response support pack",
        processFocus: "create reply frameworks, booking paths, and review gates",
        outputSections: [
          "Reply frameworks",
          "Objection handling",
          "Booking path",
          "Escalation rules",
          "Tracking sheet outline",
        ],
        nextAction: "Report campaign results and refine the next revival cycle.",
      },
    ];
  }
  if (cat === "Reputation") {
    return [
      {
        suffix: "reputation-audit",
        nameSuffix: "Reputation Audit",
        purposeVerb: "Audit reviews, feedback, and trust gaps",
        deliverableType: "Reputation audit",
        processFocus: "review rating trends, response gaps, and proof assets",
        outputSections: [
          "Reputation baseline",
          "Review volume / velocity findings",
          "Response gaps",
          "Proof asset gaps",
          "Priority actions",
        ],
        nextAction: "Design the review request and response system.",
      },
      {
        suffix: "trust-system-design",
        nameSuffix: "Trust System Design",
        purposeVerb: "Design review request, response, and recovery systems",
        deliverableType: "Trust system design",
        processFocus: "define request triggers, response templates, and recovery paths",
        outputSections: [
          "Request system blueprint",
          "Response framework",
          "Negative-review recovery path",
          "Testimonial capture outline",
          "Owner responsibilities",
        ],
        nextAction: "Build the amplification and multi-location operating pack.",
      },
      {
        suffix: "proof-and-amplification",
        nameSuffix: "Proof & Amplification",
        purposeVerb: "Create proof capture and amplification plans",
        deliverableType: "Trust amplification pack",
        processFocus: "plan testimonials, case studies, and distribution with approvals",
        outputSections: [
          "Testimonial capture plan",
          "Case study outline",
          "Amplification channels",
          "Approval checklist",
          "Reporting outline",
        ],
        nextAction: "Monitor reputation KPIs and refine monthly.",
      },
    ];
  }
  // Video Authority
  return [
    {
      suffix: "authority-audit",
      nameSuffix: "Authority Audit",
      purposeVerb: "Audit expert positioning and video content gaps",
      deliverableType: "Video authority audit",
      processFocus: "review pillars, formats, distribution, and proof opportunities",
      outputSections: [
        "Positioning findings",
        "Content gap analysis",
        "Format mix recommendations",
        "Distribution gaps",
        "Priority content opportunities",
      ],
      nextAction: "Define content pillars and a 90-day plan.",
    },
    {
      suffix: "content-system-design",
      nameSuffix: "Content System Design",
      purposeVerb: "Design pillars, formats, and a 90-day content system",
      deliverableType: "Video content system design",
      processFocus: "define pillars, cadence, formats, and production briefs",
      outputSections: [
        "Content pillars",
        "Format mix",
        "90-day outline",
        "Production brief template",
        "Repurposing map",
      ],
      nextAction: "Produce the first recording briefs and distribution checklist.",
    },
    {
      suffix: "production-and-distribution",
      nameSuffix: "Production & Distribution",
      purposeVerb: "Create production briefs and distribution plans",
      deliverableType: "Production & distribution pack",
      processFocus: "specify briefs, editing notes, captions, and channel plans",
      outputSections: [
        "Recording briefs",
        "Editing / caption notes",
        "Distribution checklist",
        "Repurposing checklist",
        "Performance review plan",
      ],
      nextAction: "Review performance and optimize the next content cycle.",
    },
  ];
}

function field(
  key: string,
  label: string,
  opts: Partial<WorkflowInputField> & { required: boolean }
): WorkflowInputField {
  return {
    key,
    label,
    type: opts.type ?? "textarea",
    required: opts.required,
    placeholder: opts.placeholder,
    help: opts.help,
    options: opts.options,
  };
}

/** Remaining AI Advantage services (after Process / Use-Case / Prompt specializations). */
function aiEnablementServiceReadinessInputs(
  serviceName: string
): WorkflowInputField[] | null {
  const map: Record<string, WorkflowInputField[]> = {
    "Marketing and Content Workflow Enablement": [
      field("content_workflow_scope", "Marketing / content workflows to assess", {
        required: true,
        placeholder: "Channels, asset types, and content tasks in scope.",
        help: "Assess readiness to enable AI-assisted marketing and content workflows.",
      }),
      field("current_content_practices", "Current content practices", {
        required: true,
        placeholder: "How content is planned, drafted, approved, and published today.",
      }),
      field("content_quality_gaps", "Quality / consistency gaps", {
        required: false,
        placeholder: "Tone drift, slow production, missing approvals, brand risk.",
      }),
    ],
    "Customer Communication Workflow Enablement": [
      field("communication_scope", "Customer communication workflows to assess", {
        required: true,
        placeholder: "Enquiry replies, follow-ups, reminders, objection handling, etc.",
        help: "Assess readiness to enable AI-assisted customer communication workflows.",
      }),
      field("current_response_practices", "Current response practices", {
        required: true,
        placeholder: "Channels, owners, response times, templates in use today.",
      }),
      field("tone_compliance_risks", "Tone / compliance risks", {
        required: false,
        placeholder: "Where messages go off-brand, too slow, or claim too much.",
      }),
    ],
    "Administration and Operations Workflow Enablement": [
      field("ops_workflow_scope", "Admin / operations workflows to assess", {
        required: true,
        placeholder: "Scheduling, documentation, handoffs, internal reporting, etc.",
        help: "Assess readiness to enable AI-assisted admin and operations workflows.",
      }),
      field("current_ops_practices", "Current operations practices", {
        required: true,
        placeholder: "How work is tracked, handed off, and approved today.",
      }),
      field("ops_bottlenecks", "Known bottlenecks", {
        required: false,
        placeholder: "Rework, missing owners, tool sprawl, delayed approvals.",
      }),
    ],
    "Knowledge Base and Staff Enablement": [
      field("knowledge_scope", "Knowledge / training scope to assess", {
        required: true,
        placeholder: "SOPs, FAQs, onboarding materials, role playbooks.",
        help: "Assess readiness to install knowledge-base and staff enablement systems.",
      }),
      field("existing_knowledge_assets", "Existing knowledge assets", {
        required: true,
        placeholder: "Docs, folders, chats, or tribal knowledge in use today.",
      }),
      field("training_adoption_gaps", "Training / adoption gaps", {
        required: false,
        placeholder: "What staff cannot find, reuse, or trust today.",
      }),
    ],
    "AI Governance, Risk and Quality Controls": [
      field("governance_scope", "Governance / risk scope to assess", {
        required: true,
        placeholder: "Use cases, data types, approval rules, and quality controls in scope.",
        help: "Assess readiness for AI governance, risk, and quality controls.",
      }),
      field("known_risk_areas", "Known risk areas", {
        required: true,
        placeholder: "Data leakage, unverified claims, unsupervised client sends, etc.",
      }),
      field("policy_gaps", "Policy / control gaps", {
        required: false,
        placeholder: "Missing policies, logs, review gates, or escalation paths.",
      }),
    ],
    "AI Reporting and Optimization": [
      field("reporting_scope", "Reporting / optimization scope to assess", {
        required: true,
        placeholder: "Which workflows, KPIs, or cycles need reporting first.",
        help: "Assess readiness to report on and optimize AI-enabled workflows.",
      }),
      field("current_metrics", "Current metrics / observations", {
        required: true,
        placeholder: "What is measured today (even if informal).",
      }),
      field("optimization_questions", "Optimization questions", {
        required: false,
        placeholder: "What decisions should reporting unlock?",
      }),
    ],
  };
  return map[serviceName] ?? null;
}

function aiEnablementServiceDesignInputs(
  serviceName: string
): WorkflowInputField[] | null {
  const map: Record<string, WorkflowInputField[]> = {
    "Marketing and Content Workflow Enablement": [
      field("priority_content_workflows", "Priority content workflows to design", {
        required: true,
        placeholder: "Which marketing/content workflows from readiness come first?",
      }),
      field("content_system_components", "Content system components to design", {
        required: true,
        placeholder: "Briefs, prompts, calendars, approval gates, brand rules.",
      }),
      field("distribution_channels", "Distribution channels", {
        required: false,
        placeholder: "Email, social, blog, ads, etc.",
      }),
    ],
    "Customer Communication Workflow Enablement": [
      field("priority_communication_flows", "Priority communication flows to design", {
        required: true,
        placeholder: "Which enquiry/follow-up flows should this system cover?",
      }),
      field("response_system_components", "Response system components", {
        required: true,
        placeholder: "Templates, prompts, escalation rules, tone guides, owners.",
      }),
      field("sla_targets", "SLA / response targets", {
        required: false,
        type: "text",
        placeholder: "Example: reply within 15 minutes during business hours",
      }),
    ],
    "Administration and Operations Workflow Enablement": [
      field("priority_ops_workflows", "Priority ops workflows to design", {
        required: true,
        placeholder: "Which admin/ops workflows from readiness come first?",
      }),
      field("ops_system_components", "Ops system components", {
        required: true,
        placeholder: "Checklists, prompts, handoff rules, trackers, owners.",
      }),
      field("tooling_constraints", "Tooling constraints", {
        required: false,
        placeholder: "Must use existing tools / cannot add new systems.",
      }),
    ],
    "Knowledge Base and Staff Enablement": [
      field("priority_knowledge_areas", "Priority knowledge areas to design", {
        required: true,
        placeholder: "Which topics/roles should the knowledge system cover first?",
      }),
      field("knowledge_system_structure", "Knowledge system structure", {
        required: true,
        placeholder: "Taxonomy, ownership, update cadence, access rules.",
      }),
      field("staff_roles_in_scope", "Staff roles in scope", {
        required: false,
        placeholder: "Who will use and maintain the knowledge base?",
      }),
    ],
    "AI Governance, Risk and Quality Controls": [
      field("priority_controls_to_design", "Priority controls to design", {
        required: true,
        placeholder: "Which governance controls from readiness come first?",
      }),
      field("control_framework_components", "Control framework components", {
        required: true,
        placeholder: "Policies, approval matrices, logging, escalation, QC checklists.",
      }),
      field("data_sensitivity_notes", "Data sensitivity notes", {
        required: false,
        placeholder: "PII, clinical, financial, or confidential data considerations.",
      }),
    ],
    "AI Reporting and Optimization": [
      field("priority_reporting_loops", "Priority reporting loops to design", {
        required: true,
        placeholder: "Which workflows/KPIs should the reporting system cover first?",
      }),
      field("reporting_system_components", "Reporting system components", {
        required: true,
        placeholder: "Metrics, cadence, owners, review ritual, change log.",
      }),
      field("decision_triggers", "Decision triggers", {
        required: false,
        placeholder: "When should results force a process change?",
      }),
    ],
  };
  return map[serviceName] ?? null;
}

function aiEnablementServicePlaybookInputs(
  serviceName: string
): WorkflowInputField[] | null {
  const map: Record<string, WorkflowInputField[]> = {
    "Marketing and Content Workflow Enablement": [
      field("approved_content_system_design", "Approved content system design", {
        required: true,
        placeholder: "Paste or summarize the approved marketing/content system design.",
      }),
      field("content_rollout_owners", "Content rollout owners", {
        required: true,
        placeholder: "Who creates, reviews, approves, and publishes?",
      }),
      field("content_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: next 2 content cycles",
      }),
    ],
    "Customer Communication Workflow Enablement": [
      field("approved_communication_design", "Approved communication system design", {
        required: true,
        placeholder: "Paste or summarize the approved communication system design.",
      }),
      field("communication_rollout_owners", "Communication rollout owners", {
        required: true,
        placeholder: "Who drafts, reviews, sends, and escalates?",
      }),
      field("communication_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: pilot next 10 business days",
      }),
    ],
    "Administration and Operations Workflow Enablement": [
      field("approved_ops_system_design", "Approved ops system design", {
        required: true,
        placeholder: "Paste or summarize the approved admin/ops system design.",
      }),
      field("ops_rollout_owners", "Ops rollout owners", {
        required: true,
        placeholder: "Who configures, trains, runs, and reviews?",
      }),
      field("ops_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: pilot one department for 14 days",
      }),
    ],
    "Knowledge Base and Staff Enablement": [
      field("approved_knowledge_system_design", "Approved knowledge system design", {
        required: true,
        placeholder: "Paste or summarize the approved knowledge/staff enablement design.",
      }),
      field("knowledge_rollout_owners", "Knowledge rollout owners", {
        required: true,
        placeholder: "Who authors, reviews, trains, and maintains?",
      }),
      field("knowledge_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: onboard front desk this month",
      }),
    ],
    "AI Governance, Risk and Quality Controls": [
      field("approved_governance_design", "Approved governance / controls design", {
        required: true,
        placeholder: "Paste or summarize the approved governance and QC design.",
      }),
      field("governance_rollout_owners", "Governance rollout owners", {
        required: true,
        placeholder: "Who owns policy, approvals, logging, and audits?",
      }),
      field("governance_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: enforce gates on Wave 1 use cases first",
      }),
    ],
    "AI Reporting and Optimization": [
      field("approved_reporting_design", "Approved reporting / optimization design", {
        required: true,
        placeholder: "Paste or summarize the approved reporting system design.",
      }),
      field("reporting_rollout_owners", "Reporting rollout owners", {
        required: true,
        placeholder: "Who collects metrics, reviews, and decides changes?",
      }),
      field("reporting_pilot_window", "Pilot / rollout window", {
        required: false,
        type: "text",
        placeholder: "Example: first reporting cycle in 30 days",
      }),
    ],
  };
  return map[serviceName] ?? null;
}

/** Phase-specific inputs for non–AI Enablement agency categories. */
function categoryPhaseInputs(phase: Phase, serviceName: string): WorkflowInputField[] {
  const svc = serviceName;
  const auditLike = (scopeKey: string, scopeLabel: string, findingKey: string, findingLabel: string, optKey: string, optLabel: string) => [
    field(scopeKey, scopeLabel, {
      required: true,
      placeholder: `Scope for "${svc}" — channels, segments, or process areas.`,
      help: `${phase.purposeVerb} within ${svc}.`,
    }),
    field(findingKey, findingLabel, {
      required: true,
      placeholder: "Current-state findings, friction, or evidence to assess.",
    }),
    field(optKey, optLabel, {
      required: false,
      placeholder: "Optional constraints, tools, or stakeholder notes.",
    }),
  ];

  const designLike = (focusKey: string, focusLabel: string, componentsKey: string, componentsLabel: string, optKey: string, optLabel: string) => [
    field(focusKey, focusLabel, {
      required: true,
      placeholder: `What from the prior audit should this ${phase.nameSuffix.toLowerCase()} cover for "${svc}"?`,
      help: `${phase.purposeVerb} for ${svc}.`,
    }),
    field(componentsKey, componentsLabel, {
      required: true,
      placeholder: "Components, rules, owners, and quality controls to design.",
    }),
    field(optKey, optLabel, {
      required: false,
      placeholder: "Timing, tooling, or brand constraints.",
    }),
  ];

  const playbookLike = (designKey: string, designLabel: string, ownersKey: string, ownersLabel: string, windowKey: string, windowLabel: string) => [
    field(designKey, designLabel, {
      required: true,
      placeholder: `Paste or summarize the approved design this ${phase.nameSuffix.toLowerCase()} will implement for "${svc}".`,
      help: `${phase.purposeVerb} for ${svc} with human approval gates.`,
    }),
    field(ownersKey, ownersLabel, {
      required: true,
      placeholder: "Who owns each step (names or roles)?",
    }),
    field(windowKey, windowLabel, {
      required: false,
      type: "text",
      placeholder: "Pilot / launch / review window.",
    }),
  ];

  switch (phase.suffix) {
    case "process-audit":
      return auditLike(
        "lead_process_scope",
        "Lead / booking process scope",
        "dropoff_and_timing_findings",
        "Drop-off and timing findings",
        "channel_notes",
        "Channel notes"
      );
    case "conversion-system-design":
      return designLike(
        "conversion_leak_to_design",
        "Conversion leak / path to design",
        "conversion_system_components",
        "Scripts, sequencing, and qualification rules",
        "booking_path_constraints",
        "Booking path constraints"
      );
    case "operator-playbook":
      return playbookLike(
        "approved_conversion_design",
        "Approved conversion system design",
        "operator_owners",
        "Operator owners by step",
        "operator_go_live",
        "Go-live / training window"
      );
    case "demand-audit":
      return auditLike(
        "demand_scope",
        "Demand / campaign scope",
        "demand_gap_findings",
        "Demand gap findings",
        "capacity_notes",
        "Capacity notes"
      );
    case "campaign-design":
      return designLike(
        "campaign_focus",
        "Campaign / offer focus to design",
        "campaign_system_components",
        "Offer, audience, message, and channel design",
        "campaign_budget_constraints",
        "Budget / timing constraints"
      );
    case "asset-and-launch":
      return playbookLike(
        "approved_campaign_design",
        "Approved campaign / offer design",
        "launch_owners",
        "Asset and launch owners",
        "launch_window",
        "Launch window"
      );
    case "partner-opportunity-map":
      return auditLike(
        "partner_map_scope",
        "Partner / alliance scope",
        "partner_opportunity_findings",
        "Partner opportunity findings",
        "relationship_notes",
        "Existing relationship notes"
      );
    case "joint-offer-design":
      return designLike(
        "joint_offer_focus",
        "Joint offer / co-marketing focus",
        "joint_offer_components",
        "Offer structure, roles, and promotion design",
        "partner_constraints",
        "Partner constraints"
      );
    case "partner-onboarding":
      return playbookLike(
        "approved_joint_offer_design",
        "Approved joint offer / partnership design",
        "partner_onboarding_owners",
        "Onboarding / governance owners",
        "partner_onboarding_window",
        "Onboarding window"
      );
    case "presence-audit":
      return auditLike(
        "presence_scope",
        "Local presence / listings scope",
        "presence_findings",
        "Presence consistency findings",
        "location_notes",
        "Location / multi-site notes"
      );
    case "optimization-plan":
      return designLike(
        "presence_priority_fixes",
        "Priority presence fixes to design",
        "presence_optimization_components",
        "Profile, category, photo, post, and Q&A plan",
        "presence_constraints",
        "Platform / brand constraints"
      );
    case "operating-cadence":
      return playbookLike(
        "approved_presence_plan",
        "Approved presence optimization plan",
        "presence_cadence_owners",
        "Operating cadence owners",
        "presence_cadence_window",
        "Cadence start window"
      );
    case "referral-audit":
      return auditLike(
        "referral_scope",
        "Referral program scope",
        "referral_gap_findings",
        "Referral gap findings",
        "referrer_notes",
        "Customer / professional / staff notes"
      );
    case "program-design":
      return designLike(
        "referral_program_focus",
        "Referral program focus to design",
        "referral_program_components",
        "Incentives, ask moments, tracking, recognition",
        "referral_compliance_notes",
        "Compliance / incentive constraints"
      );
    case "enablement-and-tracking":
      return playbookLike(
        "approved_referral_program_design",
        "Approved referral program design",
        "referral_enablement_owners",
        "Enablement and tracking owners",
        "referral_enablement_window",
        "Enablement window"
      );
    case "retention-audit":
      return auditLike(
        "retention_scope",
        "Retention / repeat-revenue scope",
        "retention_gap_findings",
        "Churn / rebooking gap findings",
        "lifecycle_notes",
        "Lifecycle stage notes"
      );
    case "retention-system-design":
      return designLike(
        "retention_system_focus",
        "Retention system focus to design",
        "retention_system_components",
        "Triggers, offers, cadence, ownership",
        "retention_constraints",
        "Offer / membership constraints"
      );
    case "lifecycle-playbook":
      return playbookLike(
        "approved_retention_design",
        "Approved retention system design",
        "lifecycle_owners",
        "Lifecycle playbook owners",
        "lifecycle_window",
        "Pilot window"
      );
    case "opportunity-audit":
      return auditLike(
        "revival_scope",
        "Revenue revival / reactivation scope",
        "dormant_opportunity_findings",
        "Dormant / unclosed opportunity findings",
        "list_quality_notes",
        "List quality notes"
      );
    case "reactivation-campaign":
      return designLike(
        "reactivation_campaign_focus",
        "Reactivation campaign focus",
        "reactivation_campaign_components",
        "Segments, offers, scripts, sequencing",
        "reactivation_constraints",
        "Compliance / tone constraints"
      );
    case "response-support":
      return playbookLike(
        "approved_reactivation_design",
        "Approved reactivation campaign design",
        "response_support_owners",
        "Response / booking support owners",
        "response_support_window",
        "Support window"
      );
    case "reputation-audit":
      return auditLike(
        "reputation_scope",
        "Reputation / review scope",
        "reputation_findings",
        "Review and feedback findings",
        "platform_notes",
        "Platform / location notes"
      );
    case "trust-system-design":
      return designLike(
        "trust_system_focus",
        "Trust system focus to design",
        "trust_system_components",
        "Monitoring, response, recovery, proof assets",
        "trust_constraints",
        "Brand / legal constraints"
      );
    case "proof-and-amplification":
      return playbookLike(
        "approved_trust_system_design",
        "Approved trust system design",
        "proof_amplification_owners",
        "Proof and amplification owners",
        "proof_amplification_window",
        "Rollout window"
      );
    case "authority-audit":
      return auditLike(
        "authority_content_scope",
        "Video authority / content scope",
        "authority_gap_findings",
        "Authority / content gap findings",
        "expert_positioning_notes",
        "Expert positioning notes"
      );
    case "content-system-design":
      return designLike(
        "video_content_system_focus",
        "Video content system focus",
        "video_content_system_components",
        "Pillars, formats, briefs, distribution",
        "production_constraints",
        "Production constraints"
      );
    case "production-and-distribution":
      return playbookLike(
        "approved_video_content_design",
        "Approved video content system design",
        "production_distribution_owners",
        "Production and distribution owners",
        "production_window",
        "Production / publish window"
      );
    default:
      return [];
  }
}

function phaseSpecificInputs(phase: Phase, serviceName: string): WorkflowInputField[] {
  if (phase.suffix === "system-design") {
    if (serviceName === "Process and Task Mapping") {
      return [
        {
          key: "process_selected_for_design",
          label: "Process selected for system design",
          type: "textarea",
          required: true,
          placeholder: "Which process from readiness mapping should this design cover?",
          help: "Workflow 5 designs the mapped process system — focus on one prioritized process area.",
        },
        {
          key: "current_step_sequence",
          label: "Current step sequence / actors",
          type: "textarea",
          required: true,
          placeholder: "List steps and who does each today (even if messy or incomplete).",
        },
        {
          key: "target_handoff_rules",
          label: "Target handoff / quality rules",
          type: "textarea",
          required: false,
          placeholder: "Desired ownership, SLAs, or quality gates for the redesigned flow.",
        },
      ];
    }
    if (serviceName === "AI Use-Case Prioritization and Roadmap") {
      return [
        {
          key: "shortlisted_use_cases",
          label: "Shortlisted use cases for the roadmap",
          type: "textarea",
          required: true,
          placeholder: "Which use cases from readiness should this roadmap design cover?",
          help: "Workflow 8 designs the prioritization/roadmap system — focus on the shortlisted set.",
        },
        {
          key: "scoring_model",
          label: "Scoring / ranking model to design",
          type: "textarea",
          required: true,
          placeholder: "How should impact, effort, risk, and readiness be scored and sequenced?",
        },
        {
          key: "roadmap_horizon",
          label: "Roadmap horizon",
          type: "text",
          required: false,
          placeholder: "Example: 30 / 60 / 90 days, or Q1–Q2",
        },
      ];
    }
    if (serviceName === "Prompt Systems and Workflow SOPs") {
      return [
        {
          key: "priority_prompt_workflows",
          label: "Priority workflows for prompt / SOP design",
          type: "textarea",
          required: true,
          placeholder: "Which workflows from readiness should this prompt system cover first?",
          help: "Workflow 11 designs the prompt library and SOP structure — focus on prioritized workflows.",
        },
        {
          key: "prompt_library_structure",
          label: "Prompt library structure to design",
          type: "textarea",
          required: true,
          placeholder: "Folders, naming, versions, inputs/outputs, and review checkpoints.",
        },
        {
          key: "human_approval_gates",
          label: "Human approval gates",
          type: "textarea",
          required: false,
          placeholder: "What must a human approve before use or client send?",
        },
      ];
    }
    const aiDesign = aiEnablementServiceDesignInputs(serviceName);
    if (aiDesign) return aiDesign;
    return [
      {
        key: "priority_opportunity",
        label: "Priority opportunity to design",
        type: "textarea",
        required: true,
        placeholder: "Which opportunity from readiness findings should this system address?",
        help: "Focus design on one prioritized opportunity — do not redesign everything at once.",
      },
      {
        key: "existing_tools",
        label: "Current tools / stack",
        type: "textarea",
        required: false,
        placeholder: "CRM, docs, chat, scheduling, or other tools the design must fit.",
      },
    ];
  }
  if (phase.suffix === "readiness-assessment") {
    if (serviceName === "Process and Task Mapping") {
      return [
        {
          key: "process_scope",
          label: "Process / task area to assess",
          type: "textarea",
          required: true,
          placeholder: "Example: enquiry intake → quote → booking → follow-up",
          help: "Workflow 4 assesses readiness to map and improve a specific process area.",
        },
        {
          key: "known_friction",
          label: "Known friction / drop-offs",
          type: "textarea",
          required: true,
          placeholder: "Where work stalls, handoffs fail, or rework happens today.",
        },
        {
          key: "systems_of_record",
          label: "Systems of record for this process",
          type: "textarea",
          required: false,
          placeholder: "Spreadsheets, CRM, inbox, paper forms, etc.",
        },
      ];
    }
    if (serviceName === "AI Use-Case Prioritization and Roadmap") {
      return [
        {
          key: "candidate_use_cases",
          label: "Candidate AI use cases to assess",
          type: "textarea",
          required: true,
          placeholder: "List hypothesized or requested use cases (even if incomplete).",
          help: "Workflow 7 assesses readiness to prioritize use cases into a practical roadmap.",
        },
        {
          key: "prioritization_criteria",
          label: "Prioritization criteria",
          type: "textarea",
          required: true,
          placeholder: "Impact, effort, risk, speed-to-value, compliance — what matters most?",
        },
        {
          key: "stakeholder_capacity",
          label: "Stakeholder / adoption capacity",
          type: "textarea",
          required: false,
          placeholder: "Who must buy in, and how much change bandwidth exists?",
        },
      ];
    }
    if (serviceName === "Prompt Systems and Workflow SOPs") {
      return [
        {
          key: "prompt_sop_scope",
          label: "Prompt / SOP scope to assess",
          type: "textarea",
          required: true,
          placeholder: "Which roles, tasks, or workflows need prompts and SOPs first?",
          help: "Workflow 10 assesses readiness to install prompt systems and workflow SOPs.",
        },
        {
          key: "existing_prompts_sops",
          label: "Existing prompts / SOPs (if any)",
          type: "textarea",
          required: true,
          placeholder: "What written or informal guidance exists today?",
        },
        {
          key: "quality_risk_gaps",
          label: "Quality / consistency risks",
          type: "textarea",
          required: false,
          placeholder: "Where output quality, tone, or compliance drifts without SOPs?",
        },
      ];
    }
    const aiReady = aiEnablementServiceReadinessInputs(serviceName);
    if (aiReady) return aiReady;
    return [
      {
        key: "current_ai_usage",
        label: "Current AI usage (if any)",
        type: "textarea",
        required: false,
        placeholder: "What AI tools or experiments exist today?",
      },
    ];
  }
  if (phase.suffix === "implementation-playbook") {
    if (serviceName === "Process and Task Mapping") {
      return [
        {
          key: "approved_process_design",
          label: "Approved process map / system design",
          type: "textarea",
          required: true,
          placeholder: "Paste or summarize the approved process map this playbook will implement.",
          help: "Workflow 6 turns an approved Process and Task Mapping design into step-by-step rollout actions.",
        },
        {
          key: "rollout_owners_by_step",
          label: "Rollout owners by step",
          type: "textarea",
          required: true,
          placeholder: "Who owns each mapped step during cutover (names or roles)?",
        },
        {
          key: "pilot_cutover_window",
          label: "Pilot / cutover window",
          type: "text",
          required: false,
          placeholder: "Example: pilot next week / full cutover after training",
        },
      ];
    }
    if (serviceName === "AI Use-Case Prioritization and Roadmap") {
      return [
        {
          key: "approved_roadmap_design",
          label: "Approved roadmap / scoring design",
          type: "textarea",
          required: true,
          placeholder: "Paste or summarize the approved use-case roadmap this playbook will implement.",
          help: "Workflow 9 turns an approved prioritization roadmap into sequenced rollout actions with human gates.",
        },
        {
          key: "wave_owners",
          label: "Owners by roadmap wave",
          type: "textarea",
          required: true,
          placeholder: "Who owns Wave 1 / Wave 2 / later waves (names or roles)?",
        },
        {
          key: "first_wave_window",
          label: "First-wave execution window",
          type: "text",
          required: false,
          placeholder: "Example: next 30 days / after staff briefing",
        },
      ];
    }
    if (serviceName === "Prompt Systems and Workflow SOPs") {
      return [
        {
          key: "approved_prompt_system_design",
          label: "Approved prompt / SOP system design",
          type: "textarea",
          required: true,
          placeholder: "Paste or summarize the approved prompt/SOP system design from system design (WF11).",
          help: "Workflow 12 turns an approved prompt library / SOP design into a practical implementation and rollout plan.",
        },
        {
          key: "implementation_owners",
          label: "Implementation owners",
          type: "textarea",
          required: true,
          placeholder: "Who creates, reviews, approves, maintains, and uses the prompt/SOP system?",
        },
        {
          key: "rollout_and_testing_window",
          label: "Rollout and testing window",
          type: "textarea",
          required: false,
          placeholder: "Target implementation, testing, pilot, or rollout timing.",
        },
      ];
    }
    const aiPlay = aiEnablementServicePlaybookInputs(serviceName);
    if (aiPlay) return aiPlay;
    return [
      {
        key: "approved_system_summary",
        label: "Approved system design summary",
        type: "textarea",
        required: true,
        placeholder: "Paste or summarize the approved enablement system design this playbook will implement.",
        help: "Turns an approved design into step-by-step operator actions with human approval gates.",
      },
      {
        key: "operator_roles",
        label: "Operators / owners for this rollout",
        type: "textarea",
        required: true,
        placeholder: "Who will run each step (names or roles)?",
      },
      {
        key: "go_live_window",
        label: "Target go-live window",
        type: "text",
        required: false,
        placeholder: "Example: next 14 days / after staff training",
      },
    ];
  }

  // Non–AI Enablement phases (Booking Flow, Demand, Alliance, Presence, etc.)
  const bySuffix = categoryPhaseInputs(phase, serviceName);
  if (bySuffix.length) return bySuffix;
  return [];
}

function commonInputs(serviceName: string): WorkflowInputField[] {
  return [
    {
      key: "client_context",
      label: "Client / business context",
      type: "textarea",
      required: true,
      placeholder: "Summarize the client business, niche, and current situation.",
      help: "Pulled from client profile when available — refine as needed.",
    },
    {
      key: "service_focus",
      label: "Service focus",
      type: "text",
      required: true,
      placeholder: serviceName,
    },
    {
      key: "goals",
      label: "Goals for this workflow",
      type: "textarea",
      required: true,
      placeholder: "What should this workflow achieve for the client?",
    },
    {
      key: "constraints",
      label: "Constraints / permissions",
      type: "textarea",
      required: false,
      placeholder: "Budget, tools, brand rules, approval requirements, what must NOT be done autonomously.",
    },
    {
      key: "additional_notes",
      label: "Additional notes",
      type: "textarea",
      required: false,
      placeholder: "Any extra context, examples, or source material.",
    },
  ];
}

function buildInstructionTemplate(
  entry: AgencyCatalogEntry,
  serviceName: string,
  phase: Phase
): string {
  const output = outputDefinitionFor(phase, serviceName);
  const specific = phaseSpecificInputs(phase, serviceName);
  const specificBlock =
    specific.length > 0
      ? specific.map((f) => `${f.label.toUpperCase()}\n{{${f.key}}}`).join("\n\n")
      : "(no additional phase-specific inputs)";

  const purposeExtra =
    serviceName === "Prompt Systems and Workflow SOPs" &&
    phase.suffix === "implementation-playbook"
      ? "\nTurn the approved prompt/SOP system design into a practical implementation, testing, approval, and rollout plan. Do NOT redesign the system; do NOT claim that AI Enterprise Studio deploys prompts or changes client systems autonomously."
      : "";

  return `You are assisting an operator of ${entry.name} (${entry.tagline}) inside AI Enterprise Studio.

ROLE
Produce an original, reviewable ${output.deliverableType.toLowerCase()} for human approval. Do not claim autonomous execution of client work.

AGENCY CONTEXT
- Agency: {{agency_name}}
- Niche: {{target_niche}}
- Market: {{country}} / {{geographic_service_area}}
- AI platform preference: {{ai_platform}}
- Delivery model: {{preferred_delivery_model}}

CLIENT CONTEXT
{{client_context}}

PRODUCT / SERVICE / WORKFLOW
- Product: ${entry.name}
- Service: {{service_focus}}
- Workflow: ${serviceName} — ${phase.nameSuffix}

WORKFLOW PURPOSE
${phase.purposeVerb} for "${serviceName}".
Focus: ${phase.processFocus}.${purposeExtra}

OPERATOR GOALS
{{goals}}

WORKFLOW-SPECIFIC INPUTS
${specificBlock}

CONSTRAINTS & PERMISSIONS
{{constraints}}

ADDITIONAL NOTES
{{additional_notes}}

TASK INSTRUCTIONS
1. Produce a professional ${output.deliverableType.toLowerCase()} suitable for human review.
2. Be specific to "${serviceName}" and the inputs above — avoid generic filler.
3. Clearly separate assumptions from evidence-based recommendations.
4. Do NOT instruct autonomous contacting, publishing, booking, CRM changes, ad launches, review posting, or client-account modifications.
5. Include a short human-review checklist at the end.

EXPECTED OUTPUT SECTIONS
${output.sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

QUALITY REQUIREMENTS
- Practical and operator-ready
- Aligned to niche, constraints, and human approval
- No income guarantees or unsupported automation claims

Tone: professional, clear, operator-ready.`;
}

function outputDefinitionFor(
  phase: Phase,
  serviceName: string
): { deliverableType: string; sections: string[] } {
  if (
    phase.suffix === "implementation-playbook" &&
    serviceName === "Prompt Systems and Workflow SOPs"
  ) {
    return {
      deliverableType: "Prompt & SOP Implementation Playbook",
      sections: [
        "Implementation Objective",
        "Approved Scope",
        "Priority Implementation Sequence",
        "Prompt/SOP Work Items",
        "Ownership & Responsibilities",
        "Creation/Configuration Tasks",
        "Testing Plan",
        "Test Cases",
        "Human Approval Gates",
        "Pilot/Rollout Plan",
        "Training & Handoff",
        "Documentation",
        "Quality Control",
        "Maintenance Plan",
        "Risks & Dependencies",
        "First Actions",
      ],
    };
  }
  // Phase definitions already carry category-specific deliverable + sections
  return {
    deliverableType: phase.deliverableType,
    sections: phase.outputSections,
  };
}

function reviewChecklist(phase: Phase, serviceName?: string): string[] {
  if (
    serviceName === "Prompt Systems and Workflow SOPs" &&
    phase.suffix === "implementation-playbook"
  ) {
    return [
      "Confirm the plan matches the approved prompt/SOP system design",
      "Verify owners are realistic and clearly assigned",
      "Confirm implementation order is practical",
      "Confirm testing covers important prompt/SOP use cases",
      "Confirm approval gates are clearly defined",
      "Confirm client data/security considerations are respected",
      "Remove unsupported automation or autonomous deployment claims",
      "Confirm rollout timing is realistic",
      "Confirm maintenance responsibilities are assigned",
      "Confirm the plan is suitable for client approval before any implementation",
    ];
  }

  const deliverable = phase.deliverableType.toLowerCase();
  const auditish = /audit|assessment|mapping|readiness/i.test(phase.suffix + phase.nameSuffix);
  const designish = /design|plan|system/i.test(phase.suffix + phase.nameSuffix);
  const playbookish = /playbook|launch|cadence|onboarding|support|amplification|distribution|tracking/i.test(
    phase.suffix + phase.nameSuffix
  );

  if (auditish) {
    return [
      "Verify findings against client-approved information",
      `Confirm the ${deliverable} accurately reflects current-state gaps and opportunities`,
      "Flag unsupported assumptions separately from evidence",
      "Remove anything that would require autonomous client contact or publishing",
      "Confirm recommended next step is practical for the niche and constraints",
      "Obtain client permission before implementing any external change",
    ];
  }
  if (designish) {
    return [
      "Confirm the design addresses the prioritized opportunity/scope",
      "Verify roles, components, and quality controls are clear",
      `Confirm the ${deliverable} is implementable without further invention`,
      "Remove unsupported automation or autonomous deployment claims",
      "Confirm fit with client tools, brand, and constraints",
      "Obtain client approval before building the implementation playbook",
    ];
  }
  if (playbookish) {
    return [
      "Confirm the plan matches the approved design/scope",
      "Verify owners and sequence are realistic",
      "Confirm testing, approval gates, and rollout steps are clear",
      `Confirm the ${deliverable} is usable by an operator without further invention`,
      "Remove unsupported automation or autonomous client-account actions",
      "Obtain client permission before any external implementation",
    ];
  }
  return [
    "Verify facts against client-approved information",
    "Remove anything that would require autonomous client contact or publishing",
    "Confirm recommendations are appropriate for the client's niche and constraints",
    `Confirm the ${deliverable} is usable by an operator without further invention`,
    "Obtain client permission before implementing any external change",
  ];
}

/**
 * Build the full workflow catalog for one agency.
 * Counts match Stage 3A targets by adding a continuity workflow when needed.
 */
export function buildWorkflowsForAgency(entry: AgencyCatalogEntry): WorkflowSpec[] {
  const phases = phasesForAgency(entry);
  const workflows: WorkflowSpec[] = [];
  let order = 0;

  for (const serviceName of entry.services) {
    for (const phase of phases) {
      order += 1;
      const serviceSlug = slugifyService(serviceName);
      const output = outputDefinitionFor(phase, serviceName);
      const isPromptSopPlaybook =
        serviceName === "Prompt Systems and Workflow SOPs" &&
        phase.suffix === "implementation-playbook";
      workflows.push({
        key: `${serviceSlug}-${phase.suffix}`,
        name: `${serviceName} — ${phase.nameSuffix}`,
        description: `${phase.purposeVerb} within ${serviceName} for ${entry.name}.`,
        purpose: isPromptSopPlaybook
          ? `Produce a reviewable Prompt & SOP Implementation Playbook that turns the approved prompt/SOP system design into sequenced creation, testing, approval, and rollout actions — without autonomous deployment.`
          : `${phase.purposeVerb} related to "${serviceName}" so the operator can produce a reviewable ${phase.deliverableType.toLowerCase()}.`,
        serviceName,
        displayOrder: order,
        inputs: [...commonInputs(serviceName), ...phaseSpecificInputs(phase, serviceName)],
        aiInstructionTemplate: buildInstructionTemplate(entry, serviceName, phase),
        outputDefinition: output,
        reviewRequirements: {
          checklist: reviewChecklist(phase, serviceName),
          autonomousActionsForbidden: true,
        },
        nextAction: isPromptSopPlaybook
          ? "Obtain client approval, then run the first prompt/SOP pilot cycle and a quality review."
          : phase.nextAction,
        steps: [
          { id: 1, name: "Collect inputs", instruction: "Confirm agency setup, client context, and workflow inputs." },
          { id: 2, name: "Generate AI instruction", instruction: "Build the provider-ready instruction from context." },
          { id: 3, name: "Run externally or with connected provider", instruction: "Use the selected AI platform; do not skip human review." },
          { id: 4, name: "Human review", instruction: "Edit and approve before any client-facing use." },
          { id: 5, name: "Save result", instruction: "Store the deliverable for reuse and reporting." },
        ],
      });
    }
  }

  // Top up to workflowTargetCount with distinct continuity / reporting workflows
  let extra = 0;
  while (workflows.length < entry.workflowTargetCount) {
    extra += 1;
    const serviceName =
      entry.services[(extra - 1) % entry.services.length] ?? entry.services[0];
    const serviceSlug = slugifyService(serviceName);
    order += 1;
    workflows.push({
      key: `${serviceSlug}-continuity-review-${extra}`,
      name: `${serviceName} — Continuity & Performance Review`,
      description: `Review outcomes and plan the next operating cycle for ${serviceName}.`,
      purpose: `Evaluate results from "${serviceName}" work and define the next improvement cycle without inventing guarantees.`,
      serviceName,
      displayOrder: order,
      inputs: [
        ...commonInputs(serviceName),
        {
          key: "results_to_date",
          label: "Results / observations to date",
          type: "textarea",
          required: true,
          placeholder: "What happened after previous workflows or campaigns?",
        },
      ],
      aiInstructionTemplate: `You are assisting ${entry.name} inside AI Enterprise Studio.

CLIENT CONTEXT
{{client_context}}

SERVICE
{{service_focus}}

GOALS
{{goals}}

RESULTS TO DATE
{{results_to_date}}

CONSTRAINTS
{{constraints}}

Produce a Continuity & Performance Review with:
1. Outcome summary
2. What worked
3. What needs improvement
4. Recommended next workflows
5. Human review checklist
Do not claim income guarantees. Do not recommend autonomous client actions.`,
      outputDefinition: {
        deliverableType: "Continuity & performance review",
        sections: [
          "Outcome summary",
          "What worked",
          "Improvements",
          "Next workflow recommendations",
          "Review checklist",
        ],
      },
      reviewRequirements: {
        checklist: reviewChecklist({
          suffix: "continuity",
          nameSuffix: "Continuity",
          purposeVerb: "Review",
          deliverableType: "Continuity review",
          processFocus: "review",
          outputSections: [],
          nextAction: "",
        }),
        autonomousActionsForbidden: true,
      },
      nextAction: "Select the next highest-priority workflow from the recommendations.",
      steps: [
        { id: 1, name: "Collect results", instruction: "Gather observations from prior work." },
        { id: 2, name: "Generate review instruction", instruction: "Build the AI instruction." },
        { id: 3, name: "Human review", instruction: "Validate recommendations." },
        { id: 4, name: "Save", instruction: "Store the review for the next cycle." },
      ],
    });
  }

  // If somehow over target (shouldn't), trim
  return workflows.slice(0, entry.workflowTargetCount);
}

export function buildAllWorkflows(catalog: AgencyCatalogEntry[]) {
  const byAgency: Record<string, WorkflowSpec[]> = {};
  let total = 0;
  for (const entry of catalog) {
    const list = buildWorkflowsForAgency(entry);
    byAgency[entry.slug] = list;
    total += list.length;
  }
  return { byAgency, total };
}
