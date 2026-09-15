"use client";

import { displayAgencyName } from "./ProductShell";

export function ProductReadyCta({
  productName,
  onStart,
}: {
  productName: string;
  onStart: () => void;
}) {
  return (
    <section className="as-ready" aria-label="Ready to build">
      <div className="as-ready-left">
        <div className="as-ready-icon" aria-hidden>
          🚀
        </div>
        <span>Your {displayAgencyName(productName)} Agency is ready to build.</span>
      </div>
      <button type="button" className="as-btn lime" onClick={onStart}>
        Start Using Workflows →
      </button>
    </section>
  );
}

export function ProductStudioFooter() {
  return (
    <footer className="as-footer">
      <div>
        <strong>AI STUDIO</strong>
        {" | Build Smarter Agencies for Local Businesses"}
      </div>
      <div>✓ Practical AI. Real Businesses. Better Results.</div>
    </footer>
  );
}
