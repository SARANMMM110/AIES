"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiClientError } from "@/lib/api";

type ResaleRow = {
  key: string;
  name: string;
  resell: boolean;
  whiteLabel: boolean;
};

export default function AccountPage() {
  const { user, refresh, logout } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resale, setResale] = useState<ResaleRow[] | null>(null);
  const [resaleError, setResaleError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    void apiFetch<ResaleRow[]>("/api/reseller/account")
      .then(setResale)
      .catch((err: Error) => setResaleError(err.message));
  }, [user]);

  async function saveResale(row: ResaleRow, next: { resell: boolean; whiteLabel: boolean }) {
    setSavingKey(row.key);
    setResaleError(null);
    try {
      const saved = await apiFetch<ResaleRow>("/api/reseller/account", {
        method: "PUT",
        body: JSON.stringify({ key: row.key, ...next }),
      });
      setResale((current) => (current ?? []).map((item) => (item.key === saved.key ? { ...item, ...saved } : item)));
    } catch (err) {
      setResaleError(err instanceof ApiClientError ? err.message : "Could not update resale");
    } finally {
      setSavingKey(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/api/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName }),
      });
      await refresh();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Account"
          subtitle="Profile, purchases, and the resell or white-label settings for catalog items you bought."
        />
        <div className="dash-split">
          <div className="panel" style={{ maxWidth: 520 }}>
            <form className="form" onSubmit={(e) => void onSubmit(e)}>
              <label>
                Email
                <input value={user?.email ?? ""} disabled />
              </label>
              <label>
                Role
                <input value={user?.role ?? ""} disabled />
              </label>
              <label>
                First name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
              {message ? <p className="success">{message}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <button className="btn" type="submit">
                Save profile
              </button>
            </form>
          </div>
          <div className="panel" style={{ maxWidth: 520 }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Change password</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Update your sign-in password. Other active sessions will be signed out.
            </p>
            <ChangePasswordForm compact />
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Purchases & session</h2>
            <p className="muted">
              View purchase history, or log out to revoke the current server session.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <a className="btn" href="/account/purchases">
                View purchase history
              </a>
              <button className="btn ghost" type="button" onClick={() => void logout()}>
                Log out
              </button>
            </div>
          </div>
        </div>
        <section className="panel" style={{ marginTop: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Reseller</h2>
          <p className="muted">
            Enable resale for agencies you own, then open the reseller portal to brand pages, create
            offers, and collect customer inquiries.
          </p>
          {resaleError ? <p className="error">{resaleError}</p> : null}
          {resale === null && !resaleError ? <p className="muted">Loading reseller options…</p> : null}
          {resale && resale.length === 0 ? (
            <p className="muted">
              No agencies available to resell yet. Unlock an agency first, then turn on Resell here.
            </p>
          ) : null}
          {resale && resale.length > 0 ? (
            <ul className="simple-list">
              {resale.map((row) => (
                <li key={row.key}>
                  <div>
                    <strong>{row.name}</strong>
                    <span className="list-meta">
                      {row.resell ? "Resale on" : "Use only"}
                      {row.resell && row.whiteLabel ? " · White label on" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={row.resell}
                        disabled={savingKey === row.key}
                        onChange={(e) =>
                          void saveResale(row, {
                            resell: e.target.checked,
                            whiteLabel: e.target.checked ? row.whiteLabel : false,
                          })
                        }
                      />
                      Resell
                    </label>
                    <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={row.whiteLabel}
                        disabled={savingKey === row.key || !row.resell}
                        onChange={(e) => void saveResale(row, { resell: true, whiteLabel: e.target.checked })}
                      />
                      White label
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <a className="btn lime" href="/reseller">
              Open reseller portal
            </a>
            {resale && resale.length > 0 && !resale.some((row) => row.resell) ? (
              <p className="muted" style={{ margin: 0, alignSelf: "center" }}>
                Turn on Resell for at least one agency above to unlock the portal.
              </p>
            ) : null}
          </div>
        </section>
      </AppShell>
    </Protected>
  );
}
