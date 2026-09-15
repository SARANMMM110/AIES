import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AgencyOneService = {
  id: string;
  title: string;
};

export type AgencyOneWorkflow = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  serviceResourceId: string | null;
  aiInstructionTemplate: string | null;
  outputDefinition: unknown;
  nextAction: string | null;
};

export type AgencyOneExportInput = {
  name: string;
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  accent?: string | null;
  brandName?: string | null;
  logoDataUrl?: string | null;
  faviconDataUrl?: string | null;
  footerText?: string | null;
  services: AgencyOneService[];
  workflows: AgencyOneWorkflow[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsString(value: string): string {
  return JSON.stringify(value ?? "");
}

function outputText(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.summary === "string") return row.summary;
    if (typeof row.description === "string") return row.description;
  }
  return "Clear headed sections. Keep language plain and confident.";
}

function displayName(name: string): string {
  return name.replace(/\s+Agency$/i, "").trim() || name;
}

function loadTemplate(): string {
  const candidates = [
    join(__dirname, "agency-one-template.html"),
    join(process.cwd(), "src/modules/products/agency-one-template.html"),
    join(process.cwd(), "AI_Advantage_Agency_One_Layout (1).html"),
    join(process.cwd(), "../../AI_Advantage_Agency_One_Layout (1).html"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error("Agency One HTML template not found");
}

function buildServicesJs(services: AgencyOneService[]): string {
  const rows = services.map((service, index) => {
    const key = `s${index + 1}`;
    return `{k:${jsString(key)}, label:${jsString(service.title)}}`;
  });
  return `var SERVICES = [\n${rows.map((row) => `  ${row}`).join(",\n")}\n];`;
}

function buildWorkflowsJs(
  services: AgencyOneService[],
  workflows: AgencyOneWorkflow[]
): string {
  const serviceKey = new Map(services.map((service, index) => [service.id, `s${index + 1}`]));
  const rows = workflows.map((workflow, index) => {
    const cat = workflow.serviceResourceId
      ? serviceKey.get(workflow.serviceResourceId) || "setup"
      : "setup";
    const desc =
      workflow.description ||
      workflow.purpose ||
      "Guided workflow for this agency.";
    const task =
      workflow.aiInstructionTemplate ||
      workflow.purpose ||
      workflow.description ||
      `Complete the “${workflow.name}” workflow for this agency and client context.`;
    const out = outputText(workflow.outputDefinition);
    return (
      `{id:${jsString(`w${index + 1}`)}, cat:${jsString(cat)}, title:${jsString(workflow.name)}, ` +
      `desc:${jsString(desc)},\n  task:${jsString(task)},\n  out:${jsString(out)}}`
    );
  });
  return `var WORKFLOWS = [\n${rows.map((row) => ` ${row}`).join(",\n")}\n];`;
}

/**
 * Downloadable agency HTML = designed Agency One layout
 * (same visual system as the in-app workspace preview).
 */
export function buildAgencyOneHtml(input: AgencyOneExportInput): string {
  const name = input.name.trim() || "Agency";
  const short = displayName(name);
  const wfCount = String(input.workflows.length || 0);
  const accent =
    input.accent && input.accent.startsWith("#") ? input.accent : "#2563EB";
  const brand = (input.brandName || "AI ENTERPRISE STUDIO").trim();
  const lede =
    (input.shortDescription || input.description || input.tagline || "").trim() ||
    `Build and operate ${short} with guided services, client context and reusable AI workflows.`;

  let html = loadTemplate();

  html = html.replace(
    /:root\{[\s\S]*?--shadow:0 1px 2px rgba\(20,31,26,\.05\);\s*\}/,
    `:root{
  --agency-accent:${accent};
  --bg:#F7F5EE; --ink:#141F1A; --muted:#5C6B62; --card:#FFFFFF; --line:#E6E4D9;
  --sage:color-mix(in srgb, var(--agency-accent) 16%, #ffffff);
  --sage-soft:color-mix(in srgb, var(--agency-accent) 9%, #ffffff);
  --deep:color-mix(in srgb, var(--agency-accent) 78%, #0a0f14);
  --deep-2:color-mix(in srgb, var(--agency-accent) 88%, #05080c);
  --lime:color-mix(in srgb, var(--agency-accent) 28%, #f7ffb0);
  --lime-ink:color-mix(in srgb, var(--agency-accent) 55%, #111827);
  --pill:color-mix(in srgb, var(--agency-accent) 18%, #ffffff); --dot:color-mix(in srgb, var(--agency-accent) 22%, #e8ece8);
  --input:#FFFFFF; --input-line:#DDDBD0; --danger:#B4433A; --shadow:0 1px 2px rgba(20,31,26,.05);
}`
  );

  html = html.replace(
    /<title>AI Advantage — Agency Business Builder &amp; Operations System<\/title>/,
    `<title>${esc(short)} — Agency Business Builder &amp; Operations System</title>`
  );

  if (input.faviconDataUrl) {
    const fav = input.faviconDataUrl.trim();
    const typeHint = fav.includes("image/x-icon") || fav.includes(".ico")
      ? ' type="image/x-icon"'
      : fav.includes("image/png")
        ? ' type="image/png"'
        : fav.includes("image/webp")
          ? ' type="image/webp"'
          : "";
    html = html.replace(
      /<title>/,
      `<link rel="icon"${typeHint} href="${esc(fav)}">\n<link rel="shortcut icon"${typeHint} href="${esc(fav)}">\n<title>`
    );
  }

  const brandMark = input.logoDataUrl
    ? `<img src="${esc(input.logoDataUrl)}" alt="" style="height:22px;width:auto;border-radius:4px;display:block" /><span>${esc(brand.toUpperCase())}</span><span class="dash"></span>`
    : `<span>${esc(brand.toUpperCase())}</span><span class="dash"></span>`;
  html = html.replace(
    /<div class="brand"><span>AI ENTERPRISE STUDIO<\/span><span class="dash"><\/span><\/div>/,
    `<div class="brand">${brandMark}</div>`
  );

  // Footer + any leftover AES marks must follow the rebranded company name.
  html = html.replace(
    /<span class="bn">AI ENTERPRISE STUDIO<\/span>/g,
    `<span class="bn">${esc(brand.toUpperCase())}</span>`
  );
  html = html.replace(/AI ENTERPRISE STUDIO/g, esc(brand.toUpperCase()));
  if (input.footerText?.trim()) {
    html = html.replace(
      /Own the system\. Deliver with judgment\./g,
      esc(input.footerText.trim())
    );
  }

  html = html.replace(
    /<h1 class="title">AI Advantage<\/h1>/,
    `<h1 class="title">${esc(short)}</h1>`
  );
  html = html.replace(
    /<p class="lede">Build and operate a consulting business that shows local companies where AI genuinely helps — mapping their processes, installing reusable prompt systems and SOPs, training their teams, controlling risk and proving the improvement with clear reporting\.<\/p>/,
    `<p class="lede">${esc(lede)}</p>`
  );

  html = html.replace(
    /GENERATE 31 CUSTOM AGENCY WORKFLOWS/g,
    `GENERATE ${wfCount} CUSTOM AGENCY WORKFLOWS`
  );
  html = html.replace(
    /<div class="big"><b>31<\/b><span>GUIDED WORKFLOWS<\/span><\/div>/,
    `<div class="big"><b>${wfCount}</b><span>GUIDED WORKFLOWS</span></div>`
  );
  html = html.replace(
    /Your AI Advantage Agency workspace is ready\./g,
    `Your ${esc(short)} Agency workspace is ready.`
  );
  html = html.replace(
    /of 31 guided workflows/g,
    `of ${wfCount} guided workflows`
  );

  html = html.replace(
    /var SERVICES = \[[\s\S]*?\];/,
    buildServicesJs(input.services)
  );
  html = html.replace(
    /var WORKFLOWS = \[[\s\S]*?\];/,
    buildWorkflowsJs(input.services, input.workflows)
  );

  html = html.replace(
    /var KEY = "aies_ai_advantage_v1";/,
    `var KEY = ${jsString(`aies_${input.slug}_v1`)};`
  );

  html = html.replace(
    /<\/body>/,
    `<!-- AES agency-one export · ${esc(input.slug)} · accent ${esc(accent)} -->\n</body>`
  );

  return html;
}
