/**
 * Stage 3B — Original AI Enterprise Studio resource content (guides, strategy, sales).
 * Not vendor content. Based on approved agency concepts.
 */

import type { AgencyCatalogEntry } from "./agency-catalog";
import { FAQ_PRINCIPLES } from "./agency-catalog";

export function buildOperatorGuide(entry: AgencyCatalogEntry) {
  return {
    status: "READY",
    stage: "3B",
    version: 1,
    title: `${entry.name} — Operator Guide`,
    agency: entry.name,
    body: {
      overview: entry.description,
      idealClients: entry.idealClient,
      problemsSolved: entry.problemsAddressed,
      serviceModel: `Select from ${entry.services.length} catalog services. Start with audits, then install systems, then report and optimize.`,
      howToConfigure: [
        "Open Agency Setup and choose your AI platform (ChatGPT, Claude, Gemini, or Custom).",
        "Set agency name, market, niche, service area, experience level, and delivery model.",
        "Select the services you will offer from the approved catalog.",
        "Save configuration so workflows can inject agency context automatically.",
      ],
      howToChooseServices: [
        "Match services to client problems — do not activate everything by default.",
        "Prefer an audit service first when the client situation is unclear.",
        "Keep selected services aligned with your weekly capacity and experience level.",
      ],
      howToOnboardClients: [
        "Create a client profile with business context, goals, tools, and constraints.",
        "Link a project to the client and this agency product.",
        "Confirm permissions: no autonomous contact, publish, or account changes.",
      ],
      howToRunWorkflows: [
        "Select a service, then open a guided workflow.",
        "Confirm inputs (agency + client context are pre-filled when available).",
        "Generate the AI instruction, run it on your selected platform if needed, paste/edit the output.",
        "Complete human review before any client-facing use.",
        "Save the result for reuse and reporting.",
      ],
      qualityControl: [
        "Every AI output requires human review.",
        "Do not send, publish, or change client accounts from this platform.",
        "Document assumptions and missing information.",
        "Prefer client-approved facts over invented claims.",
      ],
      reporting: "Use continuity/reporting workflows after implementation cycles.",
      retention:
        "Offer monthly optimization, additional catalog services, or cross-agency expansion only when appropriate — never with income guarantees.",
      principles: [...FAQ_PRINCIPLES],
    },
  };
}

export function buildBusinessStrategy(entry: AgencyCatalogEntry) {
  return {
    status: "READY",
    stage: "3B",
    version: 1,
    title: `${entry.name} — Agency Business Strategy`,
    strategy: {
      positioning: `${entry.name} — ${entry.tagline}`,
      idealCustomerProfile: entry.idealClient,
      commonPainPoints: entry.problemsAddressed,
      valueProposition: entry.valueProposition,
      offerStructure: [
        "Discovery / audit engagement",
        "System design & installation package",
        "Monthly operating / optimization retainer (optional)",
      ],
      suggestedPackaging: `Lead with an audit service, then package 2–4 related ${entry.category.toLowerCase()} services into a delivery sprint.`,
      deliveryModel:
        "Human-led research, client approval, implementation support, and quality review. AI assists; operators decide.",
      workflowHighlights: entry.services.slice(0, 5).map((s) => `${s} guided workflows`),
      commercialPositioning:
        "Sell an operating system and outcomes process — not autonomous software or guaranteed results.",
      clientConversationAngles: [
        `We help you solve: ${entry.problemsAddressed[0]}`,
        "We configure a repeatable system your team can run with human oversight.",
        "You approve every client-facing action before it goes live.",
      ],
      retentionOpportunities: [
        "Monthly reporting and optimization",
        "Expand selected services from the catalog",
        "Add adjacent agency modules when the client is ready",
      ],
      disclaimer:
        "No income or client-acquisition guarantees. External AI provider costs are separate.",
    },
  };
}

export function buildSalesPage(entry: AgencyCatalogEntry) {
  const serviceList = entry.services
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("\n");
  const problems = entry.problemsAddressed
    .map((p) => `<li>${escapeHtml(p)}</li>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(entry.name)} | AI Enterprise Studio</title>
  <style>
    body{font-family:Georgia,serif;margin:0;color:#122;background:#f7f5f1;line-height:1.55}
    .wrap{max-width:820px;margin:0 auto;padding:2.5rem 1.25rem}
    h1{font-size:2.2rem;margin:0 0 .5rem}
    .tag{color:#3d6b5a;font-weight:600;letter-spacing:.02em}
    .hero{padding:2rem 0 1rem;border-bottom:1px solid #ddd}
    section{padding:1.5rem 0;border-bottom:1px solid #eee}
    h2{font-size:1.35rem;margin:0 0 .75rem}
    ul{margin:.4rem 0 0 1.1rem}
    .cta{display:inline-block;margin-top:1rem;padding:.8rem 1.2rem;background:#2a6b55;color:#fff;text-decoration:none;border-radius:8px}
    .note{font-size:.9rem;color:#555}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="tag">AI Enterprise Studio Agency</p>
      <h1>${escapeHtml(entry.name)}</h1>
      <p><strong>${escapeHtml(entry.tagline)}</strong></p>
      <p>${escapeHtml(entry.shortDescription)}</p>
      <a class="cta" href="#contact">Talk to us</a>
    </header>
    <section>
      <h2>The problem</h2>
      <ul>${problems}</ul>
    </section>
    <section>
      <h2>The solution</h2>
      <p>${escapeHtml(entry.valueProposition)}</p>
      <p>${escapeHtml(entry.description)}</p>
    </section>
    <section>
      <h2>Benefits</h2>
      <ul>
        <li>Structured services you can select and package</li>
        <li>Guided workflows that produce reviewable deliverables</li>
        <li>Human approval before any client-facing action</li>
        <li>Reusable results for reporting and retention</li>
      </ul>
    </section>
    <section>
      <h2>Services</h2>
      <ul>${serviceList}</ul>
    </section>
    <section>
      <h2>How it works</h2>
      <ol>
        <li>Configure the agency for your market and niche</li>
        <li>Select the services that fit the client</li>
        <li>Capture the client profile and goals</li>
        <li>Run guided workflows and review AI-assisted outputs</li>
        <li>Deliver with permission — then measure and improve</li>
      </ol>
    </section>
    <section id="contact">
      <h2>Next step</h2>
      <p>Contact your AI Enterprise Studio operator to discuss fit and packaging.</p>
      <p class="note">This page is editable agency marketing content. It does not guarantee income or client acquisition. External AI provider costs are separate.</p>
    </section>
  </div>
</body>
</html>`;

  return {
    status: "READY",
    stage: "3B",
    version: 1,
    title: `${entry.name} — Client Sales Page`,
    editable: true,
    html,
    outline: [
      "Hero",
      "Problem",
      "Solution",
      "Benefits",
      "Services",
      "How it works",
      "CTA / contact",
    ],
    cta: { label: "Talk to us", contactEmail: null, contactUrl: null },
  };
}

export function buildSalesCopy(entry: AgencyCatalogEntry) {
  return {
    status: "READY",
    stage: "3B",
    version: 1,
    title: `${entry.name} — Sales Copy`,
    blocks: {
      elevatorPitch: entry.valueProposition,
      headlineOptions: [
        entry.tagline,
        `${entry.name}: structured systems for ${entry.category.toLowerCase()}`,
        `Stop improvising. Install a ${entry.category.toLowerCase()} operating system.`,
      ],
      benefitBullets: [
        ...entry.problemsAddressed.map((p) => `Address: ${p}`),
        "Human-reviewed deliverables — not autonomous actions",
        "Selectable services packaged to client needs",
      ],
      serviceHighlights: entry.services.slice(0, 6),
      objectionHandlers: [
        {
          objection: "Is this just ChatGPT prompts?",
          response:
            "No — it is a structured agency operating system with services, guided workflows, review gates, and reusable deliverables.",
        },
        {
          objection: "Will this contact my customers automatically?",
          response:
            "No. AI Enterprise Studio does not autonomously contact clients, publish, or change accounts. Operators approve every external action.",
        },
        {
          objection: "Do you guarantee results?",
          response:
            "No income or acquisition guarantees. We provide operating systems and professional process support.",
        },
      ],
      emailSnippets: [
        {
          name: "Intro",
          body: `We help ${entry.idealClient.toLowerCase()} with ${entry.tagline.toLowerCase()} through a structured service and workflow system.`,
        },
      ],
      targetCustomer: entry.idealClient,
      commercialAngles: [
        "Operating system, not one-off busywork",
        "Permission-based delivery",
        "Expand services as the client is ready",
      ],
    },
  };
}

export function buildPositioning(entry: AgencyCatalogEntry) {
  return {
    status: "READY",
    stage: "3B",
    version: 1,
    title: `${entry.name} — Positioning`,
    positioning: {
      tagline: entry.tagline,
      idealClient: entry.idealClient,
      problemsAddressed: entry.problemsAddressed,
      valueProposition: entry.valueProposition,
      category: entry.category,
      commercialAngles: [
        "Structured agency operations inside AI Enterprise Studio",
        "Choose one agency model — you do not need all 10",
        "Human research, approval, and quality review remain required",
      ],
      differentiator:
        "An independently usable agency product with selectable services and guided workflows — not a generic chatbot wrapper.",
    },
  };
}

export function buildExpandedWiki(catalog: AgencyCatalogEntry[]) {
  return {
    status: "READY",
    stage: "3B",
    version: 2,
    scope: "shared",
    searchableTags: [
      "wiki",
      "setup",
      "workflows",
      "ai-platform",
      "review",
      "quality",
    ],
    sections: [
      {
        id: "overview",
        title: "Platform overview",
        items: [
          "AI Enterprise Studio hosts independent agency products on one reusable framework.",
          "Each agency has services, guided workflows, resources, and product-level access.",
          "Users choose the agency model that fits — they do not need all 10.",
        ],
      },
      {
        id: "choosing",
        title: "Choosing an agency",
        items: catalog.map((a) => `${a.name}: ${a.tagline} — ideal for ${a.idealClient}`),
      },
      {
        id: "setup",
        title: "Agency setup",
        items: [
          "Configure AI platform (ChatGPT, Claude, Gemini, Custom/Other).",
          "Set agency name, country/market, niche, service area, experience, delivery model, capacity, and targets.",
          "Select catalog services you will offer. Save to resume later.",
        ],
      },
      {
        id: "clients",
        title: "Client setup",
        items: [
          "Create a client profile with business context, goals, tools, channels, and problems.",
          "Associate clients with projects under an agency product.",
          "Agency-specific extra fields can live in client metadata.",
        ],
      },
      {
        id: "workflows",
        title: "Workflow execution",
        items: [
          "Select service → open workflow → enter inputs → generate AI instruction.",
          "Run on your selected AI platform (or paste external output back).",
          "Human review is mandatory before client-facing use.",
          "Save results and resume incomplete work from progress records.",
        ],
      },
      {
        id: "ai-usage",
        title: "AI platform usage & quality control",
        items: [
          "Instructions are built from agency config + client + workflow purpose + inputs.",
          "Do not expose provider API keys in the browser.",
          "AI assists; operators decide. No autonomous contact, publish, or account changes.",
          ...FAQ_PRINCIPLES,
        ],
      },
      {
        id: "delivery",
        title: "Client delivery",
        items: [
          "Deliver reviewed outputs as documents, plans, scripts, or reports.",
          "Obtain permissions before implementing external changes.",
          "Use continuity workflows for measurement and the next cycle.",
        ],
      },
    ],
    note: "Original AI Enterprise Studio Agency Wiki — expanded in Stage 3B.",
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
