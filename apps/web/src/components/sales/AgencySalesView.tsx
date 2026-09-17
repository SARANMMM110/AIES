"use client";

import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import type { CatalogAgency, CatalogSuite } from "@/lib/sales/catalog";
import { SERVICE_ICONS, AI_ADVANTAGE_SERVICE_BREAKS, serviceDescription } from "@/lib/sales/premium-services";
import { agencySalesImage } from "@/lib/sales/agency-images";
import { SalesInquiryForm } from "./SalesInquiryForm";
import { InquireSection } from "./InquireSection";
import { SalesFooter, SalesHeader } from "./SalesChrome";
import { SalesResaleSection } from "./SalesResaleSection";
import { ScrollToPurchase } from "./ScrollToPurchase";
import "./purchase-flow.css";
import "./catalog-sales.css";
import "./inquiry-form.css";

function accentInk(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length < 6) return "#14200c";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#14200c" : "#ffffff";
}

function shortName(name: string) {
  return name.replace(/\s+Agency$/i, "");
}

/** Premium sales page matching AI_Advantage_Agency_Sales_Page_Full_Premium_Content_v2.html */
export function AgencySalesView({
  agency,
  agencies,
  suite,
  embed = false,
  framed = false,
}: {
  agency: CatalogAgency;
  agencies: CatalogAgency[];
  suite: CatalogSuite;
  /** Read-only embed for locked product preview iframe */
  embed?: boolean;
  /** Owned-product frame: hide the sales-site header. Actions live in the studio header. */
  framed?: boolean;
}) {
  const accent = agency.accent || "#caff45";
  const ink = accentInk(accent);
  const name = agency.name;
  const short = shortName(name);
  const isAiAdvantage = agency.slug === "ai-advantage-agency";
  const heroImage = agencySalesImage(agency.slug);

  const heroTitle = isAiAdvantage ? (
    <>
      Build a Smarter,
      <br />
      More Efficient
      <br />
      <span>Business with AI.</span>
    </>
  ) : (
    <>
      Build a clearer system
      <br />
      for {short}.
      <br />
      <span>Operate with confidence.</span>
    </>
  );

  const heroLead = isAiAdvantage
    ? "Identify opportunities. Streamline operations. Empower your team. The AI Advantage Agency helps you turn AI from a buzzword into real business results."
    : agency.shortDescription ||
      agency.description ||
      `${name} helps operators deliver structured work with guided workflows and human review.`;

  const faqs = isAiAdvantage
    ? [
        {
          q: "What is AI Advantage Agency?",
          a: "A structured AI enablement system for identifying opportunities, designing workflows, creating implementation plans and improving how teams use AI.",
        },
        {
          q: "How many services and workflows are included?",
          a: `AI Advantage Agency includes ${agency.serviceCount} services and ${agency.workflowCount} guided workflows.`,
        },
        {
          q: "Can I purchase this agency separately?",
          a: "Yes. AI Advantage Agency can be purchased individually, or you can purchase the complete suite containing all 10 agencies.",
        },
        {
          q: "Does the system automatically change client accounts?",
          a: "No. Human review, approvals, implementation and permissions remain with the appropriate people.",
        },
        {
          q: "Can I use the agency for different clients?",
          a: "Yes. The workspace is designed around agency and client context, so the same system can support separate client projects while keeping workflow results independent.",
        },
        {
          q: "What happens after an AI output is generated?",
          a: "You review the output using the workflow's review requirements, refine it as needed, and save the approved result. The system is designed around human approval rather than autonomous deployment.",
        },
        {
          q: "Can I start with only one service?",
          a: "Yes. Services can be selected according to the agency configuration and used through their associated guided workflows.",
        },
        {
          q: "Can I resell this agency?",
          a: "Yes, after you purchase it from AI Enterprise Studio. Turn on resale in your Account, then create offers and collect customer inquiries in the reseller portal. Your customers get use access only — they cannot resell further.",
        },
        {
          q: "What is white label?",
          a: "Optional branding for the sales pages you publish: your logo, brand name, and colors. Access still runs through AI Enterprise Studio. Enable white label with resale in your Account.",
        },
      ]
    : [
        {
          q: `What is ${name}?`,
          a: `${name} is an AI Enterprise Studio product with ${agency.serviceCount} services and ${agency.workflowCount} guided workflows.`,
        },
        {
          q: "Can I purchase this agency separately?",
          a: "Yes, or explore the Complete Suite for all 10 agencies.",
        },
        {
          q: "Does the system automatically change client accounts?",
          a: "No. Human review, approvals, implementation and permissions remain with the appropriate people.",
        },
        {
          q: "Can I resell this agency?",
          a: "Yes, after you purchase it from AI Enterprise Studio. Turn on resale in your Account, then create offers and collect customer inquiries in the reseller portal. Your customers get use access only — they cannot resell further.",
        },
        {
          q: "What is white label?",
          a: "Optional branding for the sales pages you publish: your logo, brand name, and colors. Access still runs through AI Enterprise Studio. Enable white label with resale in your Account.",
        },
      ];

  return (
    <div
      className={`sales-root${embed ? " sales-embed" : ""}`}
      style={
        {
          ["--sales-accent"]: accent,
          ["--green"]: accent,
          ["--sales-accent-ink"]: ink,
        } as CSSProperties
      }
    >
      {embed ? (
        <div className="sales-embed-bar">
          <span>{name} · sales preview</span>
          <span className="sales-embed-pill">PREVIEW ONLY</span>
        </div>
      ) : framed ? null : (
        <SalesHeader />
      )}

      <main>
        <section className="hero">
          <div className="container hero-in">
            <div className="hero-copy">
              <div className="eyebrow">{name}</div>
              <h1>{heroTitle}</h1>
              <p>{heroLead}</p>
              <div className="hero-actions">
                <ScrollToPurchase className="btn lime">
                  Purchase this agency →
                </ScrollToPurchase>
                <a className="btn outline" href="#solution">
                  See How It Works ◉
                </a>
              </div>
              <div className="proofs">
                <div className="proof">
                  <i className="proof-icon">✦</i>
                  Practical
                  <br />
                  &amp; Actionable
                </div>
                <div className="proof">
                  <i className="proof-icon">♧</i>
                  Guided
                  <br />
                  Workflows
                </div>
                <div className="proof">
                  <i className="proof-icon">▦</i>
                  Real Business
                  <br />
                  Applications
                </div>
              </div>
            </div>

            <div className="hero-ui" aria-label={`${name} agency`}>
              {heroImage ? (
                <div className="hero-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroImage}
                    alt={`${name} — agency artwork`}
                    width={960}
                    height={720}
                  />
                </div>
              ) : (
                <div className="os">
                  <div className="os-rail">
                    <b>A</b>
                    <span>⌕</span>
                    <span>▦</span>
                    <span>◈</span>
                    <span>↗</span>
                  </div>
                  <div className="os-main">
                    <div className="os-head">
                      <div>
                        <h3>{short} preview</h3>
                        <p>Workspace look — preview only</p>
                      </div>
                      <span className="pill">PREVIEW</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="float impact">
                <b>Included</b>
                <small>SERVICES</small>
                <strong>{agency.serviceCount}</strong>
              </div>
              <div className="float actions-card">
                <div>
                  <i>✓</i>
                  {agency.workflowCount} workflows
                </div>
                <div>
                  <i>✓</i>Guided delivery
                </div>
                <div>
                  <i>✓</i>Human review
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section challenge">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">The Challenge</div>
                <h2>
                  Great businesses
                  <br />
                  can still do better.
                </h2>
              </div>
              <p>
                Many businesses know AI can help, but face real challenges in putting it to work
                effectively. Without clear guidance, AI opportunities are often missed, and teams are
                left experimenting without a structure.
              </p>
            </div>
            <div className="challenge-grid">
              <div className="challenge-card">
                <div className="ci">⌕</div>
                <h3>Unclear opportunities</h3>
                <p>Not knowing where AI can make a real difference.</p>
              </div>
              <div className="challenge-card">
                <div className="ci">♧</div>
                <h3>Manual, repetitive work</h3>
                <p>Valuable time spent on tasks that could be automated.</p>
              </div>
              <div className="challenge-card">
                <div className="ci">◈</div>
                <h3>Scattered information</h3>
                <p>Important knowledge is trapped in people and documents.</p>
              </div>
              <div className="challenge-card">
                <div className="ci">♧</div>
                <h3>Lack of governance</h3>
                <p>Uncertainty around proper use, quality and control.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section solution" id="solution">
          <div className="container">
            <div className="solution-top">
              <div className="head" style={{ margin: 0 }}>
                <div>
                  <div className="tag">The Solution</div>
                  <h2>
                    A clear path from
                    <br />
                    opportunity to impact.
                  </h2>
                </div>
                <p>
                  The {name} gives you a complete system to identify, design and implement solutions
                  that work for your business.
                </p>
              </div>
              <a className="btn lime" href="#services">
                Explore the Services →
              </a>
            </div>
            <div className="solution-grid">
              <div className="sol-card">
                <div className="sol-icon">⌕</div>
                <small>01</small>
                <h3>Assess</h3>
                <p>Understand your current state.</p>
              </div>
              <div className="sol-card">
                <div className="sol-icon">◌</div>
                <small>02</small>
                <h3>Identify</h3>
                <p>Find high-value opportunities.</p>
              </div>
              <div className="sol-card">
                <div className="sol-icon">▦</div>
                <small>03</small>
                <h3>Design</h3>
                <p>Create practical AI solutions.</p>
              </div>
              <div className="sol-card">
                <div className="sol-icon">ϟ</div>
                <small>04</small>
                <h3>Implement</h3>
                <p>Turn plans into action.</p>
              </div>
              <div className="sol-card">
                <div className="sol-icon">↗</div>
                <small>05</small>
                <h3>Measure</h3>
                <p>Track results and optimize.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section services" id="services">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">What&apos;s Included</div>
                <h2>
                  {agency.serviceCount} Essential Services.
                  <br />A Complete {isAiAdvantage ? "AI" : short} Foundation.
                </h2>
              </div>
              <p>
                The {name} includes {agency.serviceCount} specialized services designed to help you
                build real capability across your business.
              </p>
            </div>
            <div className="service-grid">
              {agency.services.map((title, idx) => {
                const br = AI_ADVANTAGE_SERVICE_BREAKS[title];
                return (
                  <div key={title} className="service">
                    <div className="si">{SERVICE_ICONS[idx % SERVICE_ICONS.length]}</div>
                    <b>
                      {br ? (
                        <>
                          {br[0]}
                          <br />
                          {br[1]}
                        </>
                      ) : (
                        title
                      )}
                    </b>
                    <p className="service-desc">{serviceDescription(title)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section workflow">
          <div className="container workflow-grid">
            <div>
              <div className="tag">Guided Workflows</div>
              <h2>
                {agency.workflowCount} Guided Workflows.
                <br />
                From Strategy to Execution.
              </h2>
              <p>
                Step-by-step workflows guide you through each service, with structured inputs,
                AI-powered outputs, and human review — so you can confidently turn opportunities into
                real results.
              </p>
              <div className="stats">
                <div>
                  <strong>{agency.workflowCount}</strong>
                  <span>Workflows</span>
                </div>
                <div>
                  <strong>{agency.serviceCount}</strong>
                  <span>Services</span>
                </div>
                <div>
                  <strong>1</strong>
                  <span>Complete System</span>
                </div>
              </div>
              <a className="btn lime" href="#purchase">
                See Workflow Examples →
              </a>
            </div>
            <div className="workflow-ui">
              <div className="screen">
                <div className="step">
                  <div className="stepno">1</div>
                  <div>
                    <b>Provide Your Inputs</b>
                    <span>Answer a few guided questions</span>
                  </div>
                </div>
                <div className="step">
                  <div className="stepno">2</div>
                  <div>
                    <b>Generate AI Instructions</b>
                    <span>Get a tailored prompt to use with AI</span>
                  </div>
                </div>
                <div className="step">
                  <div className="stepno">3</div>
                  <div>
                    <b>Review AI Output</b>
                    <span>Check and refine the results</span>
                  </div>
                </div>
                <div className="step">
                  <div className="stepno">4</div>
                  <div>
                    <b>Save and Implement</b>
                    <span>Keep your results and put them to work</span>
                  </div>
                </div>
              </div>
              <div className="note">
                Simple.
                <br />
                Structured.
                <br />
                <b>Effective.</b>
              </div>
            </div>
          </div>
        </section>

        <section className="section who">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Who It&apos;s For</div>
                <h2>
                  Built for Forward-Thinking
                  <br />
                  Businesses.
                </h2>
              </div>
              <p>
                Whether you&apos;re a local business, a growing company, or a multi-location operator,
                the {name} helps you build the skills, systems and workflows to operate with
                confidence.
              </p>
            </div>
            <div className="who-grid">
              <div className="who-card">
                <i className="wi">♧</i>
                <b>Service Businesses</b>
              </div>
              <div className="who-card">
                <i className="wi">▣</i>
                <b>Professional Firms</b>
              </div>
              <div className="who-card">
                <i className="wi">↗</i>
                <b>Growing Companies</b>
              </div>
              <div className="who-card">
                <i className="wi">◉</i>
                <b>Multi-Location Operators</b>
              </div>
              <div className="who-card">
                <i className="wi">♧</i>
                <b>Internal Teams</b>
              </div>
            </div>
          </div>
        </section>

        <section className="section detail-section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">What You Get</div>
                <h2>A practical system your team can actually use.</h2>
              </div>
              <p>
                {name} is designed as an operating system — not a collection of disconnected prompts.
                Each area moves from understanding the business to designing, reviewing and improving
                practical workflows.
              </p>
            </div>
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Built around your business</h3>
                <p>
                  Start with your agency configuration and client context, then work through
                  structured services and guided workflows.
                </p>
                <div className="detail-list">
                  <div className="detail-item">
                    <i>✓</i>
                    <span>Business and client context captured before execution</span>
                  </div>
                  <div className="detail-item">
                    <i>✓</i>
                    <span>Service-specific inputs instead of generic one-size-fits-all prompts</span>
                  </div>
                  <div className="detail-item">
                    <i>✓</i>
                    <span>Reusable outputs that can be reviewed, refined and saved</span>
                  </div>
                </div>
              </div>
              <div className="detail-card dark">
                <h3>Human review stays in control</h3>
                <p>
                  AI generates structured assistance. Your team remains responsible for approval,
                  implementation, permissions and final quality control.
                </p>
                <div className="detail-list">
                  <div className="detail-item">
                    <i>✓</i>
                    <span>Review requirements are built into workflows</span>
                  </div>
                  <div className="detail-item">
                    <i>✓</i>
                    <span>Approval gates before important implementation decisions</span>
                  </div>
                  <div className="detail-item">
                    <i>✓</i>
                    <span>No claim of autonomous client-account deployment</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="deliverables">
              <div className="deliverable">
                <b>Opportunity Audits</b>
                <span>Identify practical opportunities and current-state gaps.</span>
              </div>
              <div className="deliverable">
                <b>System Designs</b>
                <span>Turn selected opportunities into structured solution designs.</span>
              </div>
              <div className="deliverable">
                <b>Implementation Playbooks</b>
                <span>Translate approved designs into owners, testing and rollout actions.</span>
              </div>
              <div className="deliverable">
                <b>Optimization Results</b>
                <span>Review outcomes and create a path for continuous improvement.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section workflow" style={{ background: "linear-gradient(120deg,#08120f,#102019)" }}>
          <div className="container">
            <div className="head" style={{ display: "block", marginBottom: 0 }}>
              <div className="tag">Inside Every Workflow</div>
              <h2>
                Structured enough to guide.
                <br />
                Flexible enough to adapt.
              </h2>
              <p style={{ marginTop: 13, maxWidth: 620, color: "#9eaaa4" }}>
                Every workflow follows the same reliable operating pattern while using its own inputs,
                instructions, deliverable and review requirements.
              </p>
            </div>
            <div className="workflow-detail">
              <div className="workflow-detail-card">
                <strong>01</strong>
                <b>Inputs</b>
                <p>Capture the specific business information required for this workflow.</p>
              </div>
              <div className="workflow-detail-card">
                <strong>02</strong>
                <b>AI Instruction</b>
                <p>Generate a tailored instruction using the product, service and workflow context.</p>
              </div>
              <div className="workflow-detail-card">
                <strong>03</strong>
                <b>Review</b>
                <p>Evaluate the AI output against workflow-specific quality and approval requirements.</p>
              </div>
              <div className="workflow-detail-card">
                <strong>04</strong>
                <b>Save Result</b>
                <p>Keep the approved output so it can become part of the implementation record.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section benefits-section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Why {short}</div>
                <h2>
                  More than prompts.
                  <br />A repeatable business system.
                </h2>
              </div>
              <p>
                Designed to help agencies and teams move from scattered experimentation to a structured
                operating approach that can be reused across real business situations.
              </p>
            </div>
            <div className="benefit-grid">
              {[
                ["01", "Find the right opportunities", "Focus attention on areas where AI can create useful, measurable business value instead of chasing every new tool."],
                ["02", "Create repeatable workflows", "Turn successful approaches into structured processes that teams can follow, review and improve."],
                ["03", "Work with confidence", "Use clear review requirements and approval gates so AI-assisted work stays accountable and practical."],
                ["04", "Reduce operational friction", "Map repetitive work, identify handoff problems and create better ways for people and AI to work together."],
                ["05", "Enable your team", "Give staff usable guidance, knowledge structures and workflows instead of leaving everyone to experiment alone."],
                ["06", "Improve continuously", "Review results, identify gaps and optimize workflows as your business, team and AI capabilities evolve."],
              ].map(([n, t, p]) => (
                <div key={n} className="benefit-card">
                  <div className="big">{n}</div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section usecase-section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Business Applications</div>
                <h2>
                  Where the system
                  <br />
                  can create value.
                </h2>
              </div>
              <p>
                Use the agency across strategy, marketing, operations, customer communication,
                knowledge management and governance.
              </p>
            </div>
            <div className="usecase-grid">
              <div className="usecase-panel">
                <h3>Across everyday business work</h3>
                <p>
                  Start with the work your team already performs and identify where structured AI
                  assistance can make it clearer, faster or more consistent.
                </p>
                <div className="usecase-list">
                  {[
                    "Research, summarization and repetitive knowledge work",
                    "Marketing planning and content production workflows",
                    "Customer communication and response support",
                    "Administration, operations and internal processes",
                    "Business knowledge and staff enablement",
                  ].map((item) => (
                    <div key={item} className="usecase-item">
                      <i>✓</i>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="usecase-panel dark">
                <h3>Built for controlled capability</h3>
                <p>
                  The objective is not to automate everything. It is to create useful AI assistance
                  that is repeatable, reviewable and appropriate for the business.
                </p>
                <div className="usecase-list">
                  {[
                    "Business goals before technology",
                    "Human review built into the workflow",
                    "Pilot before expansion",
                    "Clear ownership and approval points",
                  ].map((item) => (
                    <div key={item} className="usecase-item">
                      <i>✓</i>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section example-section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Workflow Examples</div>
                <h2>
                  See how strategy
                  <br />
                  becomes execution.
                </h2>
              </div>
              <p>
                The {agency.workflowCount} workflows cover the full journey across the agency&apos;s{" "}
                {agency.serviceCount} services.
              </p>
            </div>
            <div className="example-grid">
              <div className="example">
                <div className="example-no">EXAMPLE 01</div>
                <h3>AI Readiness Assessment</h3>
                <p>Review current work, identify AI opportunities and establish a practical starting point.</p>
                <span>Readiness</span>
              </div>
              <div className="example">
                <div className="example-no">EXAMPLE 02</div>
                <h3>System Design</h3>
                <p>Take a selected opportunity and define the workflow, inputs, controls and desired outcome.</p>
                <span>Design</span>
              </div>
              <div className="example">
                <div className="example-no">EXAMPLE 03</div>
                <h3>Implementation Playbook</h3>
                <p>Translate an approved design into owners, testing, rollout actions and review gates.</p>
                <span>Implementation</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section resource-section" id="resources">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Included Resources</div>
                <h2>
                  Everything you need
                  <br />
                  to operate the system.
                </h2>
              </div>
              <p>
                Alongside the guided workflows, the agency includes practical resources that support
                delivery, positioning and business use.
              </p>
            </div>
            <div className="resource-grid">
              <div className="resource">
                <div className="resource-icon">▤</div>
                <h3>Operator Guide</h3>
                <p>Understand how to use the agency, configure context and work through the system.</p>
              </div>
              <div className="resource">
                <div className="resource-icon">↗</div>
                <h3>Business Strategy</h3>
                <p>Use the agency as part of a practical enablement and service-delivery approach.</p>
              </div>
              <div className="resource">
                <div className="resource-icon">◫</div>
                <h3>Client Sales Page</h3>
                <p>Position the service clearly when presenting to prospective clients.</p>
              </div>
              <div className="resource">
                <div className="resource-icon">✦</div>
                <h3>Sales Copy & Positioning</h3>
                <p>Support messaging, offers and positioning around practical business value.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section trust-section">
          <div className="container">
            <div className="head">
              <div>
                <div className="tag">Make It Yours</div>
                <h2>
                  Start focused.
                  <br />
                  Expand when ready.
                </h2>
              </div>
              <p>
                Purchase the {name} individually when you want a focused system, or move to the
                complete suite when you need the full range of business-growth systems.
              </p>
            </div>
            <div className="comparison">
              <div className="compare-card">
                <h3>Choose {name}</h3>
                <p>Best when your immediate goal is building capability with this specialized agency.</p>
                <div className="compare-list">
                  <div>
                    <i>✓</i>
                    {agency.serviceCount} specialized services
                  </div>
                  <div>
                    <i>✓</i>
                    {agency.workflowCount} guided workflows
                  </div>
                  <div>
                    <i>✓</i>
                    Structured inputs and outputs
                  </div>
                  <div>
                    <i>✓</i>
                    Human review and approval gates
                  </div>
                </div>
              </div>
              <div className="compare-card dark">
                <h3>Choose the Complete Suite</h3>
                <p>
                  Best when you want the broader AI Enterprise Studio system with all ten specialized
                  agencies.
                </p>
                <div className="compare-list">
                  <div>
                    <i>✓</i>
                    10 agencies
                  </div>
                  <div>
                    <i>✓</i>
                    99 services
                  </div>
                  <div>
                    <i>✓</i>
                    306 guided workflows
                  </div>
                  <div>
                    <i>✓</i>
                    One complete operating ecosystem
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="purchase-wrap" id="paths">
          <div className="container">
            <div className="purchase">
              <div className="purchase-copy">
                <div className="eyebrow">Get Started Today</div>
                <h2>
                  Choose Your Path
                  <br />
                  to {short}.
                </h2>
                <p>
                  Start with the {name} or explore the complete suite. Click Purchase to send
                  your details — there is no payment on this page.
                </p>
              </div>
              <div className="buy-grid">
                <div className="buy featured">
                  <div className="popular">Popular</div>
                  <div className="buy-icon">{short.charAt(0)}</div>
                  <h3>{name}</h3>
                  <p>
                    Get started with this agency and its {agency.serviceCount} services and{" "}
                    {agency.workflowCount} workflows.
                  </p>
                  {embed ? (
                    <p className="sales-note">Preview only — open the sales page to inquire.</p>
                  ) : (
                    <ScrollToPurchase className="btn lime">
                      Purchase this agency →
                    </ScrollToPurchase>
                  )}
                </div>
                <div className="buy">
                  <div className="buy-icon" style={{ background: "#e7efff", color: "#4c78d8" }}>
                    ▱
                  </div>
                  <h3>Complete Suite</h3>
                  <p>Get all 10 agencies with 99 services and 306 workflows.</p>
                  {embed ? (
                    <p className="sales-note">Preview only</p>
                  ) : (
                    <Link className="btn white" href="/purchase?suite=1">
                      Explore Complete Suite
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <div className="tag" style={{ justifyContent: "center" }}>
              Start Building
            </div>
            <h2>
              Build a smarter business
              <br />
              with AI.
            </h2>
            <p>Turn opportunities into practical workflows, systems and measurable business capability.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <ScrollToPurchase className="btn blue">
                Purchase this agency →
              </ScrollToPurchase>
              <a className="btn white" href="#faq">
                Learn More
              </a>
            </div>
          </div>
        </section>

        {!embed ? <SalesResaleSection compact /> : null}

        <section className="section faq" id="faq">
          <div className="container">
            <div
              className="head"
              style={{ display: "block", textAlign: "center", maxWidth: 700, margin: "0 auto 18px" }}
            >
              <div className="tag" style={{ justifyContent: "center" }}>
                FAQ
              </div>
              <h2>Questions before you start?</h2>
            </div>
            <div className="faq-list">
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {!embed ? (
          <InquireSection
            id="purchase"
            title={
              <>
                Tell us what you need.
                <span> We will unlock access.</span>
              </>
            }
            description={`Share your details to purchase ${name}. No payment is collected on this page.`}
            bullets={[
              "Response by email from the AES team",
              "Agency access unlocked after follow-up",
              "No payment on this page",
            ]}
          >
            <Suspense fallback={<p className="sales-note">Loading form…</p>}>
              <SalesInquiryForm
                variant="dark"
                productSlug={agency.slug}
                interest={name}
                ctaLabel="Send purchase details"
                showNote
              />
            </Suspense>
          </InquireSection>
        ) : null}
      </main>

      {embed ? null : <SalesFooter />}
    </div>
  );
}
