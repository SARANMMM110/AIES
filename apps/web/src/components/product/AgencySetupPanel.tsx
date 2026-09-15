"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";
import type { SetupConfig } from "./types";

const TEXT_FIELDS = [
  ["agencyName", "Agency name or working name", "Example: Practical AI Works", true],
  ["country", "Country or operating market", "Example: Australia", true],
  ["targetNiche", "Target local-business niche", "Example: Trades, clinics, local services", true],
  ["geographicServiceArea", "Geographic service area", "Example: Metro + surrounding suburbs", false],
] as const;

const SELECT_FIELDS = [
  [
    "experienceLevel",
    "Experience level",
    ["New to agencies", "Some client delivery", "Established operator"],
    true,
  ],
  [
    "preferredDeliveryModel",
    "Preferred delivery model",
    ["Done-with-you", "Done-for-you", "Hybrid / advisory"],
    true,
  ],
  [
    "weeklyTimeAvailability",
    "Weekly time available",
    ["Under 5 hours", "5–10 hours", "10–20 hours", "20+ hours"],
    true,
  ],
] as const;

export function AgencySetupPanel({
  slug,
  setup,
  aiPlatforms,
  onChange,
  onSaved,
}: {
  slug: string;
  setup: SetupConfig;
  aiPlatforms: string[];
  onChange: (next: SetupConfig) => void;
  onSaved: (next: SetupConfig) => void;
}) {
  const [baseline, setBaseline] = useState(JSON.stringify(setup));
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dirty = JSON.stringify(setup) !== baseline;
    setStatus((prev) => (dirty ? "dirty" : prev === "saved" ? "saved" : "idle"));
  }, [setup, baseline]);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setStatus("saving");
    setMessage(null);
    try {
      const data = await apiFetch<{ config: SetupConfig }>(`/api/products/${slug}/setup`, {
        method: "PUT",
        body: JSON.stringify(setup),
      });
      const next = {
        ...data.config,
        selectedServiceIds: (data.config.selectedServiceIds as string[]) || [],
      };
      onSaved(next);
      setBaseline(JSON.stringify(next));
      setStatus("saved");
      setMessage("Saved");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiClientError ? err.message : "Save failed");
    }
  }

  return (
    <section id="setup" className="as-card">
      <div className="as-card-head">
        <div className="as-card-title">
          <div className="as-card-icon" aria-hidden>
            ▤
          </div>
          <div>
            <h2>Customize Your Agency</h2>
            <p>Tell us how you want this agency model to operate.</p>
          </div>
        </div>
        <span className="as-step-badge">Step 1 of 3</span>
      </div>

      <form onSubmit={(e) => void save(e)}>
        <div className="as-platform-block">
          <p className="as-subhead">AI Platform</p>
          <label className="as-label">
            Which AI will you use?
            <select
              className="as-select"
              value={setup.aiPlatform || ""}
              onChange={(e) => onChange({ ...setup, aiPlatform: e.target.value || null })}
            >
              <option value="">Select…</option>
              {aiPlatforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="as-subhead">Agency Profile</p>
        <div className="as-form-grid">
          {TEXT_FIELDS.map(([key, label, placeholder, required]) => (
            <label key={key} className="as-label">
              <span>
                {label}
                {required ? <span className="req"> *</span> : null}
              </span>
              <input
                className="as-input"
                placeholder={placeholder}
                value={(setup[key] as string) || ""}
                onChange={(e) => onChange({ ...setup, [key]: e.target.value || null })}
              />
            </label>
          ))}

          {SELECT_FIELDS.map(([key, label, options, required]) => (
            <label key={key} className="as-label">
              <span>
                {label}
                {required ? <span className="req"> *</span> : null}
              </span>
              <select
                className="as-select"
                value={(setup[key] as string) || ""}
                onChange={(e) => onChange({ ...setup, [key]: e.target.value || null })}
              >
                <option value="">Select…</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="as-label">
            <span>Monthly income or client target</span>
            <input
              className="as-input"
              placeholder="Planning target only — not a guarantee"
              value={setup.monthlyIncomeOrClientTarget || ""}
              onChange={(e) =>
                onChange({ ...setup, monthlyIncomeOrClientTarget: e.target.value || null })
              }
            />
          </label>
        </div>

        <div className="as-save-row">
          <button className="as-btn" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save agency profile"}
          </button>
          <span
            className={`as-status ${status === "saved" ? "ok" : status === "error" ? "err" : ""}`}
          >
            {status === "dirty"
              ? "Unsaved changes"
              : status === "saved"
                ? message || "Saved"
                : status === "error"
                  ? message
                  : ""}
          </span>
        </div>
      </form>
    </section>
  );
}
