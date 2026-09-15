type VisualKind =
  | "network"
  | "funnel"
  | "campaign"
  | "partners"
  | "map"
  | "loop"
  | "lifecycle"
  | "revival"
  | "trust"
  | "video";

const MODULES: Record<VisualKind, [string, string]> = {
  network: ["Discover Opportunities", "Design Solutions"],
  funnel: ["Qualify Leads", "Book Appointments"],
  campaign: ["Shape Offers", "Build Demand"],
  partners: ["Map Alliances", "Activate Partners"],
  map: ["Audit Listings", "Improve Presence"],
  loop: ["Ask for Referrals", "Close the Loop"],
  lifecycle: ["Retain Clients", "Rebook Revenue"],
  revival: ["Segment Dormant", "Reactivate Demand"],
  trust: ["Monitor Reviews", "Build Proof"],
  video: ["Plan Pillars", "Distribute Authority"],
};

const CHECKS: Record<VisualKind, string[]> = {
  network: ["Automate", "Simplify", "Empower", "Grow"],
  funnel: ["Respond", "Qualify", "Book", "Recover"],
  campaign: ["Target", "Offer", "Launch", "Learn"],
  partners: ["Identify", "Align", "Introduce", "Measure"],
  map: ["List", "Complete", "Refresh", "Coordinate"],
  loop: ["Delight", "Ask", "Track", "Convert"],
  lifecycle: ["Serve", "Care", "Offer", "Retain"],
  revival: ["Find", "Segment", "Message", "Revive"],
  trust: ["Listen", "Respond", "Recover", "Prove"],
  video: ["Audit", "Brief", "Produce", "Publish"],
};

export function HeroVisual({
  kind,
  accent,
  agencyLabel,
}: {
  kind: VisualKind;
  accent: string;
  agencyLabel?: string;
}) {
  const modules = MODULES[kind] ?? MODULES.network;
  const checks = CHECKS[kind] ?? CHECKS.network;

  return (
    <div className="sales-visual" style={{ ["--agency-accent" as string]: accent }} aria-hidden>
      <div className="sales-dash">
        <aside className="sales-dash-side">
          <div className="mark" />
          <span style={{ width: "78%" }} />
          <span style={{ width: "62%" }} />
          <span style={{ width: "70%" }} />
          <span style={{ width: "48%" }} />
          <span style={{ width: "66%" }} />
        </aside>
        <div className="sales-dash-main">
          <div className="sales-dash-top">
            <span>{agencyLabel || "AI Operating System"}</span>
            <small>Live preview</small>
          </div>
          <div className="sales-dash-chart">
            <div className="label">+68% Business Impact</div>
            <svg viewBox="0 0 240 70" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="salesChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 55 C40 50, 55 40, 80 38 C110 35, 130 20, 160 18 C190 16, 210 10, 240 8 L240 70 L0 70 Z"
                fill="url(#salesChartFill)"
              />
              <path
                d="M0 55 C40 50, 55 40, 80 38 C110 35, 130 20, 160 18 C190 16, 210 10, 240 8"
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="sales-dash-cards">
            <div className="sales-dash-card">{modules[0]}</div>
            <div className="sales-dash-card">{modules[1]}</div>
          </div>
        </div>
      </div>
      <ul className="sales-dash-float">
        {checks.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
