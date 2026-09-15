export type SalesPageExportInput = {
  name: string;
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  category?: string;
  accent?: string;
  services: string[];
  serviceCount: number;
  workflowCount: number;
  headline?: string;
  subheadline?: string;
  benefits?: Array<{ title: string; body: string }>;
  exportedAt?: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Offline client-facing sales page HTML for one agency.
 * Marketing asset — not the workflow workspace.
 */
export function buildSalesPageHtml(input: SalesPageExportInput): string {
  const accent = esc(input.accent || "#2563eb");
  const name = esc(input.name);
  const category = esc(input.category || "Agency System");
  const headline = esc(
    input.headline || input.tagline || `Operate ${input.name} with guided workflows`
  );
  const sub = esc(
    input.subheadline ||
      input.shortDescription ||
      input.description ||
      `${input.name} helps operators deliver structured agency work with human review.`
  );
  const benefits =
    input.benefits && input.benefits.length
      ? input.benefits
      : [
          { title: "Guided workflows", body: "Structured steps from inputs to reviewed results." },
          { title: "Service coverage", body: "Use the cataloged services for this agency." },
          { title: "Human review", body: "Approve outputs before client-facing use." },
          { title: "Repeatable delivery", body: "Run the same operating pattern across clients." },
        ];

  const serviceList = input.services
    .map((s) => `<li>${esc(s)}</li>`)
    .join("\n");

  const benefitCards = benefits
    .map(
      (b) => `<article class="card"><h3>${esc(b.title)}</h3><p>${esc(b.body)}</p></article>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${name} — Sales Page | AI Enterprise Studio</title>
<meta name="description" content="${sub.slice(0, 155)}"/>
<style>
:root{--accent:${accent};--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--bg:#f7f9fc;--surface:#fff;--radius:18px}
*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Helvetica Neue,system-ui,sans-serif;background:radial-gradient(ellipse 80% 50% at 10% -10%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 55%),var(--bg);color:var(--ink);line-height:1.55}
.wrap{width:min(960px,calc(100% - 2rem));margin:0 auto}
header{display:flex;justify-content:space-between;align-items:center;padding:1rem 0;border-bottom:1px solid var(--line)}
.brand{display:flex;gap:.65rem;align-items:center;font-weight:800;letter-spacing:-.02em}
.mark{width:2rem;height:2rem;border-radius:.65rem;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),#0ea5e9);color:#fff;font-size:.7rem}
.eyebrow{color:var(--accent);font-size:.78rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase}
h1{font-size:clamp(1.9rem,4vw,3rem);line-height:1.1;letter-spacing:-.03em;margin:.4rem 0 1rem}
.lead{color:var(--muted);font-size:1.05rem;max-width:40rem}
.hero{padding:2.5rem 0 1.5rem;display:grid;gap:1.5rem}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:1rem;text-align:center}
.stat b{display:block;font-size:1.7rem;color:var(--accent)}
section{padding:2rem 0}
h2{font-size:1.45rem;margin:0 0 .75rem}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.85rem}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem 1.2rem;box-shadow:0 10px 28px rgba(15,23,42,.04)}
.card h3{margin:0 0 .35rem;font-size:1.02rem}.card p{margin:0;color:var(--muted);font-size:.95rem}
ul.services{columns:2;gap:1.5rem;margin:0;padding-left:1.15rem;color:var(--muted)}
.cta{background:#0b1220;color:#e2e8f0;border-radius:24px;padding:1.5rem 1.6rem}
.cta p{opacity:.85}.btn{display:inline-block;margin-top:.75rem;background:#fff;color:#0b1220;padding:.7rem 1.15rem;border-radius:999px;font-weight:700;text-decoration:none}
footer{padding:2rem 0;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
@media(max-width:720px){.stats,.grid{grid-template-columns:1fr}ul.services{columns:1}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand"><span class="mark">AES</span> AI Enterprise Studio</div>
    <div style="color:var(--muted);font-size:.9rem">${category}</div>
  </header>

  <section class="hero">
    <div>
      <div class="eyebrow">${category}</div>
      <h1>${headline}</h1>
      <p class="lead">${sub}</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${input.workflowCount}</b>Guided workflows</div>
      <div class="stat"><b>${input.serviceCount}</b>Services</div>
      <div class="stat"><b>1</b>Agency system</div>
    </div>
  </section>

  <section>
    <h2>What's included</h2>
    <ul class="services">
${serviceList}
    </ul>
  </section>

  <section>
    <h2>Why operators use ${name}</h2>
    <div class="grid">
${benefitCards}
    </div>
  </section>

  <section>
    <div class="cta">
      <h2 style="color:#fff;margin:0 0 .4rem">${name}</h2>
      <p>Purchase this agency in AI Enterprise Studio to access its services and guided workflows. Human review remains part of every delivery path.</p>
      <a class="btn" href="#top">Get Started</a>
    </div>
  </section>

  <footer>
    <strong>${name}</strong> · AI Enterprise Studio sales page export
    ${input.exportedAt ? ` · ${esc(input.exportedAt)}` : ""}
  </footer>
</div>
</body>
</html>`;
}
