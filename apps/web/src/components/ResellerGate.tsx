"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function ResellerGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    void apiFetch<{ entitlements: unknown[] }>("/api/reseller/me")
      .then((data) => setAllowed(data.entitlements.length > 0))
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) return <div className="panel muted">Checking reseller access…</div>;
  if (!allowed) {
    return (
      <div className="panel">
        <h2>Reseller access is not available yet</h2>
        <p className="muted">
          Enable <strong>Resell</strong> for an agency you own in Account, then return here to brand
          pages and create offers.
        </p>
        <p style={{ marginBottom: 0 }}>
          <a className="btn lime" href="/account">
            Go to Account
          </a>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
