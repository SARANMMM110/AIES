"use client";

import type { ProductResource, SetupConfig } from "./types";

export function ServiceGrid({
  services,
  setup,
  onToggle,
  onSave,
  onSelectAll,
  onClear,
  saving,
  message,
}: {
  services: ProductResource[];
  setup: SetupConfig;
  onToggle: (id: string) => void;
  onSave: () => void;
  onSelectAll?: () => void;
  onClear?: () => void;
  saving?: boolean;
  message?: string | null;
}) {
  const selected = setup.selectedServiceIds?.length ?? 0;

  return (
    <section id="services" className="as-card">
      <div className="as-card-head">
        <div className="as-card-title">
          <div className="as-card-icon" aria-hidden>
            ⊞
          </div>
          <div>
            <h2>Services Included in Your Agency Offer</h2>
            <p>Choose the approved services you will operate for clients.</p>
          </div>
        </div>
        <div className="as-services-tools">
          <span className="as-count-pill">{selected} Selected</span>
          <button type="button" className="as-btn ghost" onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className="as-btn ghost" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <div className="as-service-grid">
        {services.map((service) => {
          const on = setup.selectedServiceIds?.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              className={on ? "as-service-item selected" : "as-service-item"}
              onClick={() => onToggle(service.id)}
              aria-pressed={on}
            >
              <span className="as-check" aria-hidden>
                ✓
              </span>
              <span>{service.title}</span>
            </button>
          );
        })}
      </div>

      <div className="as-save-row">
        <button className="as-btn" type="button" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save service selection"}
        </button>
        {message ? <span className="as-status ok">{message}</span> : null}
      </div>
    </section>
  );
}
