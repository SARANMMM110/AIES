import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PremiumSalesPageInput = {
  name: string;
  slug: string;
  accent: string;
  services: string[];
  serviceCount: number;
  workflowCount: number;
  /** Reseller / white-label presentation (optional). */
  brandName?: string | null;
  /** Embedded logo data URL for white-label header */
  logoDataUrl?: string | null;
  /** Embedded favicon data URL for browser tab icon */
  faviconDataUrl?: string | null;
  inquiryUrl?: string | null;
  supportEmail?: string | null;
  footerText?: string | null;
  /** Attached reseller offer (optional). */
  offerTitle?: string | null;
  offerCopy?: string | null;
  offerCta?: string | null;
  offerPriceCents?: number | null;
  offerCurrency?: string | null;
  /** Public POST endpoint for the embedded purchase form */
  inquireEndpoint?: string | null;
  suiteUrl?: string | null;
};

function formatOfferPrice(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "";
  const code = (currency || "USD").trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
}

const SERVICE_ICONS = ["⌘", "▦", "✣", "⌘", "✂", "▣", "▥", "◫", "◈", "↗"];

const SERVICE_BREAKS: Record<string, [string, string]> = {
  "AI Readiness and Opportunity Audit": ["AI Readiness and", "Opportunity Audit"],
  "Process and Task Mapping": ["Process and", "Task Mapping"],
  "AI Use-Case Prioritization and Roadmap": ["AI Use-Case Prioritization", "and Roadmap"],
  "Prompt Systems and Workflow SOPs": ["Prompt Systems and", "Workflow SOPs"],
  "Marketing and Content Workflow Enablement": ["Marketing and Content", "Workflow Enablement"],
  "Customer Communication Workflow Enablement": ["Customer Communication", "Workflow Enablement"],
  "Administration and Operations Workflow Enablement": [
    "Administration and Operations",
    "Workflow Enablement",
  ],
  "Knowledge Base and Staff Enablement": ["Knowledge Base and", "Staff Enablement"],
  "AI Governance, Risk and Quality Controls": ["AI Governance, Risk", "and Quality Controls"],
  "AI Reporting and Optimization": ["AI Reporting and", "Optimization"],
};

const SERVICE_DESC: Record<string, string> = {
  "AI Readiness and Opportunity Audit":
    "Assess where AI can create practical value across the business.",
  "Process and Task Mapping":
    "Map repeatable work, handoffs, bottlenecks and improvement opportunities.",
  "AI Use-Case Prioritization and Roadmap":
    "Rank opportunities and turn them into a practical implementation roadmap.",
  "Prompt Systems and Workflow SOPs":
    "Create repeatable prompt systems, SOPs and quality checkpoints.",
  "Marketing and Content Workflow Enablement":
    "Build structured AI workflows for planning, creation and content operations.",
  "Customer Communication Workflow Enablement":
    "Improve customer-facing communication with consistent guided workflows.",
  "Administration and Operations Workflow Enablement":
    "Reduce repetitive operational work with documented AI-assisted processes.",
  "Knowledge Base and Staff Enablement":
    "Turn business knowledge into usable guidance, resources and staff workflows.",
  "AI Governance, Risk and Quality Controls":
    "Define responsible-use boundaries, review gates and quality controls.",
  "AI Reporting and Optimization":
    "Measure workflow performance, identify gaps and improve the system over time.",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accentInk(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length < 6) return "#14200c";
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#14200c" : "#ffffff";
}

function loadTemplate(): string {
  const candidates = [
    join(__dirname, "premium-sales-template.html"),
    join(process.cwd(), "src/modules/products/premium-sales-template.html"),
    join(process.cwd(), "AI_Advantage_Agency_Sales_Page_Full_Premium_Content_v2.html"),
    join(process.cwd(), "../../AI_Advantage_Agency_Sales_Page_Full_Premium_Content_v2.html"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error("Premium sales HTML template not found");
}

function formatServiceTitle(title: string): string {
  const br = SERVICE_BREAKS[title];
  if (br) return `${esc(br[0])}<br>${esc(br[1])}`;
  const parts = title.split(" and ");
  if (parts.length === 2) return `${esc(parts[0])} and<br>${esc(parts[1])}`;
  return esc(title);
}

function buildServiceGrid(services: string[]): string {
  return services
    .map((title, idx) => {
      const icon = SERVICE_ICONS[idx % SERVICE_ICONS.length];
      const desc =
        SERVICE_DESC[title] ||
        "Structured delivery service inside this agency for guided workflow execution.";
      return `<div class="service"><div class="si">${icon}</div><b>${formatServiceTitle(title)}</b><p class="service-desc">${esc(desc)}</p></div>`;
    })
    .join("\n");
}

/**
 * Downloadable sales page = exact premium HTML reference template,
 * recolored with the agency accent + live catalog services/counts.
 * Intentionally different from the in-app React /sales preview.
 */
export function buildPremiumSalesPageHtml(input: PremiumSalesPageInput): string {
  const accent = input.accent.startsWith("#") ? input.accent : `#${input.accent}`;
  const ink = accentInk(accent);
  const name = input.name;
  const short = name.replace(/\s+Agency$/i, "");
  const wf = String(input.workflowCount);
  const svc = String(input.serviceCount);
  const brandLabel = (input.brandName || "").trim();
  const inquiry = (input.inquiryUrl || "").trim();
  const logo = (input.logoDataUrl || "").trim();
  const favicon = (input.faviconDataUrl || "").trim();
  const offerTitle = (input.offerTitle || "").trim();
  const offerCopy = (input.offerCopy || "").trim();
  const offerCta = (input.offerCta || "").trim() || "Get This Agency →";
  const offerPriceLabel = formatOfferPrice(input.offerPriceCents, input.offerCurrency);
  const displayOffer = offerTitle || name;
  const offerShort = displayOffer.replace(/\s+Agency$/i, "").trim() || displayOffer;
  const hasOffer = Boolean(offerTitle || offerCopy || offerPriceLabel);
  const priceBlock = offerPriceLabel
    ? `<p class="buy-price" style="margin:0 0 8px;font-size:26px;font-weight:900;letter-spacing:-.04em;color:var(--green)">${esc(
        offerPriceLabel
      )}</p>`
    : "";
  const priceNote = offerPriceLabel
    ? ` Listed price ${offerPriceLabel} — there is no payment on this page.`
    : " There is no payment on this page.";

  let html = loadTemplate();

  if (favicon) {
    const typeHint = favicon.includes("image/x-icon") || favicon.includes(".ico")
      ? ' type="image/x-icon"'
      : favicon.includes("image/png")
        ? ' type="image/png"'
        : favicon.includes("image/webp")
          ? ' type="image/webp"'
          : "";
    html = html.replace(
      /<title>/,
      `<link rel="icon"${typeHint} href="${esc(favicon)}">\n<link rel="shortcut icon"${typeHint} href="${esc(favicon)}">\n<title>`
    );
  }

  // Offer must be applied on the raw template markers before agency-name swaps.
  if (hasOffer) {
    html = html.replace(
      /Choose Your Path<br>to AI Advantage\./,
      `Choose Your Path<br>to ${esc(offerShort)}.`
    );
    html = html.replace(
      /Start with the AI Advantage Agency or explore the complete suite of 10 agencies\. Either way, you get a powerful system to grow your business with AI\./,
      esc(
        offerCopy ||
          `Start with ${displayOffer}${
            offerPriceLabel ? ` (${offerPriceLabel})` : ""
          } or explore the complete suite. Send your details below — there is no payment on this page.`
      )
    );
    html = html.replace(
      /<div class="buy featured"><div class="popular">Popular<\/div><div class="buy-icon">A<\/div><h3>AI Advantage Agency<\/h3><p>Get started with this agency and its 10 services and 31 workflows\.<\/p><a class="btn lime" href="#inquire">Get This Agency →<\/a><\/div>/,
      `<div class="buy featured"><div class="popular">Popular</div><div class="buy-icon">${esc(
        (offerShort.charAt(0) || "A").toUpperCase()
      )}</div><h3>${esc(displayOffer)}</h3>${priceBlock}<p>${esc(
        offerCopy ||
          `Get started with this offer for ${name} and its ${svc} services and ${wf} workflows.`
      )}</p><a class="btn lime" href="#inquire">${esc(offerCta)}</a></div>`
    );
    html = html.replace(
      /<div class="purchase-copy"><div class="eyebrow">Purchase inquiry<\/div><h2>Request access\.<\/h2><p>Fill in your details\. There is no payment on this page — the owner will follow up by email\.<\/p><\/div>/,
      `<div class="purchase-copy"><div class="eyebrow">Purchase inquiry</div><h2>Request ${esc(
        offerShort
      )}${offerPriceLabel ? ` · ${esc(offerPriceLabel)}` : ""}.</h2><p>${esc(
        (offerCopy || "Fill in your details.") + priceNote + " The owner will follow up by email."
      )}</p></div>`
    );
    html = html.replace(
      /interest: document\.title/,
      `interest: ${JSON.stringify(displayOffer)}`
    );
    html = html.replace(/Get This Agency →/g, esc(offerCta));
    html = html.replace(
      /Choose AI Advantage Agency/,
      `Choose ${esc(displayOffer)}`
    );
  }

  html = html.replace(/--green:#caff45/g, `--green:${accent}`);
  html = html.replace(/#caff45/gi, accent);

  html = html.replace(
    /\.nav-btn\{padding:8px 14px;background:var\(--green\);color:#14200c\}/g,
    `.nav-btn{padding:8px 14px;background:var(--green);color:${ink}}`
  );
  html = html.replace(
    /\.lime\{background:var\(--green\);color:#15200d;box-shadow:0 8px 22px [^}]+\}/,
    `.lime{background:var(--green);color:${ink};box-shadow:0 8px 22px ${accent}30}`
  );
  html = html.replace(
    /\.buy-icon\{width:28px;height:28px;border-radius:7px;background:var\(--green\);color:#14200b;/g,
    `.buy-icon{width:28px;height:28px;border-radius:7px;background:var(--green);color:${ink};`
  );

  html = html.replace(
    /radial-gradient\(circle at 71% 10%,rgba\(109,176,123,\.31\),transparent 25%\),\s*radial-gradient\(circle at 92% 65%,rgba\(47,111,83,\.18\),transparent 28%\),/,
    `radial-gradient(circle at 71% 10%,color-mix(in srgb, ${accent} 31%, transparent),transparent 25%),\n radial-gradient(circle at 92% 65%,color-mix(in srgb, ${accent} 18%, transparent),transparent 28%),`
  );

  html = html.replace(
    /<title>AI Advantage Agency — AI Enterprise Studio<\/title>/,
    `<title>${esc(displayOffer)} — ${esc(brandLabel || "AI Enterprise Studio")}</title>`
  );
  html = html.replace(/AI Advantage Agency/g, name);
  html = html.replace(/AI Advantage/g, short);
  html = html.replace(/>AI ADVANTAGE</g, `>${esc(short).toUpperCase()}<`);

  html = html.replace(
    /<div class="stats"><div><strong>31<\/strong><span>Workflows<\/span><\/div><div><strong>10<\/strong><span>Services<\/span><\/div>/,
    `<div class="stats"><div><strong>${wf}</strong><span>Workflows</span></div><div><strong>${svc}</strong><span>Services</span></div>`
  );
  html = html.replace(/31 Guided Workflows\./g, `${wf} Guided Workflows.`);
  html = html.replace(/10 Essential Services\./g, `${svc} Essential Services.`);
  html = html.replace(/includes 10 specialized services/g, `includes ${svc} specialized services`);
  html = html.replace(
    /includes 10 services and 31 guided workflows/g,
    `includes ${svc} services and ${wf} guided workflows`
  );
  html = html.replace(
    /The 31 workflows cover the full AI enablement journey across the agency's 10 services\./g,
    `The ${wf} workflows cover the full journey across the agency's ${svc} services.`
  );
  html = html.replace(
    /its 10 services and 31 workflows\./g,
    `its ${svc} services and ${wf} workflows.`
  );
  html = html.replace(
    /<div><i>✓<\/i>10 specialized services<\/div>\s*<div><i>✓<\/i>31 guided workflows<\/div>/g,
    `<div><i>✓</i>${svc} specialized services</div>\n        <div><i>✓</i>${wf} guided workflows</div>`
  );

  html = html.replace(
    /<div class="service-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>\s*\n\s*<section class="section workflow">/,
    `<div class="service-grid">\n${buildServiceGrid(input.services)}\n</div>\n</div>\n</section>\n\n<section class="section workflow">`
  );

  if (!hasOffer) {
    html = html.replace(
      /<div class="buy-icon">A<\/div>/,
      `<div class="buy-icon">${esc(short.charAt(0) || "A")}</div>`
    );
  }

  if (brandLabel || logo) {
    const mark = logo
      ? `<img class="brand-logo" src="${esc(logo)}" alt="" style="height:28px;width:auto;display:block;border-radius:6px" />`
      : `<span class="brand-mark">▲</span>`;
    const label = esc(brandLabel || "AI Enterprise Studio");
    html = html.replace(
      /<a class="brand" href="#"><span class="brand-mark">▲<\/span>AI Enterprise Studio<\/a>/,
      `<a class="brand" href="#">${mark}${label}</a>`
    );
    html = html.replace(
      /© 2026 AI Enterprise Studio\. All rights reserved\./g,
      `© ${new Date().getFullYear()} ${esc(brandLabel || "AI Enterprise Studio")}. All rights reserved.`
    );
    html = html.replace(
      / — AI Enterprise Studio<\/title>/,
      ` — ${esc(brandLabel || "AI Enterprise Studio")}</title>`
    );
    html = html.replace(/AI Enterprise Studio/g, brandLabel || "AI Enterprise Studio");
  }

  if (inquiry) {
    html = html.replace(
      /There is no payment on this page\.[^<]*/g,
      "There is no payment on this page. Send your details and the owner will email you."
    );
  }

  const endpoint =
    (input.inquireEndpoint || "").trim() ||
    (inquiry ? `${inquiry.replace(/\/$/, "")}` : "");
  const suite = (input.suiteUrl || "").trim() || "#";
  html = html.replace(/__INQUIRE_ENDPOINT__/g, esc(endpoint));
  html = html.replace(/__PRODUCT_SLUG__/g, esc(input.slug));
  html = html.replace(/__SUITE_URL__/g, esc(suite));

  const supportBits = [input.supportEmail, input.footerText].filter(Boolean).map(String);
  if (supportBits.length) {
    html = html.replace(
      /<\/body>/,
      `<div style="text-align:center;padding:18px 16px 28px;color:#5c6b64;font-size:.9rem">${esc(supportBits.join(" · "))}</div>\n</body>`
    );
  }

  html = html.replace(
    /<\/body>/,
    `<!-- AES premium export · ${esc(input.slug)} · offer ${esc(displayOffer)} · accent ${esc(accent)} -->\n</body>`
  );

  return html;
}
