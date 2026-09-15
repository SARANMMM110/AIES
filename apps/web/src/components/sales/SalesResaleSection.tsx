"use client";

const POINTS = [
  {
    key: "use",
    index: "01",
    title: "Use it yourself",
    body: "Run the agency in your AI Enterprise Studio workspace — services, workflows, and client delivery in one place.",
  },
  {
    key: "resell",
    index: "02",
    title: "Resell to your customers",
    body: "After you purchase an agency, turn on resale in your account. Set your own price, publish an offer, and collect customer inquiries.",
  },
  {
    key: "brand",
    index: "03",
    title: "White label branding",
    body: "Optional. Put your logo, brand name, and colors on the sales pages you publish. Your customers see your brand — access still runs through AI Enterprise Studio.",
  },
  {
    key: "access",
    index: "04",
    title: "Simple customer access",
    body: "People who buy from you get use access only. They cannot resell or white-label further. Hierarchy stays AES → you → your customer.",
  },
] as const;

const FLOW = [
  "Enable resale and white label in Account after purchase",
  "Create offers with your pricing and sales copy",
  "Add logo, colors, and brand name in Branding",
  "Share your sales page — visitors send details by email",
  "Customers get use access only — no further resale",
] as const;

type Props = {
  compact?: boolean;
};

/** Premium resale + white-label summary for AES sales surfaces. */
export function SalesResaleSection({ compact = false }: Props) {
  return (
    <section className={`cat-resale${compact ? " is-compact" : ""}`} id="resale">
      <div className="container">
        <header className="cat-resale-head">
          <div>
            <p className="cat-kicker on-dark">Resale & white label</p>
            <h2>
              Use it.
              <span> Resell it.</span>
              <em> Brand it.</em>
            </h2>
          </div>
          <p>
            Every agency can be used in your studio. After you buy from AI Enterprise Studio, enable
            resale and optional white-label branding in Account — then manage offers, branding, and
            inquiries in the reseller portal.
          </p>
        </header>

        <div className={`cat-resale-bento${compact ? " is-compact" : ""}`}>
          {POINTS.map((point) => (
            <article key={point.key} className={`cat-resale-panel cat-resale-${point.key}`}>
              <span className="cat-resale-index">{point.index}</span>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </article>
          ))}
        </div>

        <div className="cat-resale-flow" aria-label="How resale works">
          <p className="cat-resale-flow-label">From purchase to your sales page</p>
          <ol>
            {FLOW.map((item, i) => (
              <li key={item}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
