"use client";

import { FormEvent, useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import type { ClientRow } from "./types";

export function ClientSetupPanel({
  clients,
  selectedClientId,
  onSelect,
  onClientsChange,
}: {
  clients: ClientRow[];
  selectedClientId: string;
  onSelect: (id: string) => void;
  onClientsChange: (clients: ClientRow[]) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    industry: "",
    location: "",
    goals: "",
    mainProblems: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function createClient(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/clients", { method: "POST", body: JSON.stringify(form) });
      const data = await apiFetch<{ clients: ClientRow[] }>("/api/clients");
      onClientsChange(data.clients);
      if (data.clients[0]) onSelect(data.clients[0].id);
      setForm({ name: "", industry: "", location: "", goals: "", mainProblems: "" });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create client");
    }
  }

  return (
    <section id="clients" className="product-section dash-split">
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Client context</h2>
        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Create a client profile to inject business context into workflows."
          />
        ) : (
          <label>
            Active client
            <select value={selectedClientId} onChange={(e) => onSelect(e.target.value)}>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.industry ? ` — ${c.industry}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {selectedClientId ? (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Selected client context will be included when you prepare AI instructions.
          </p>
        ) : null}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Add client</h2>
        <form className="form" onSubmit={(e) => void createClient(e)}>
          <label>
            Business name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Industry
            <input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            Main problems
            <textarea
              rows={3}
              value={form.mainProblems}
              onChange={(e) => setForm({ ...form, mainProblems: e.target.value })}
            />
          </label>
          <label>
            Goals
            <textarea
              rows={3}
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
            />
          </label>
          <button className="btn" type="submit">
            Create client
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
