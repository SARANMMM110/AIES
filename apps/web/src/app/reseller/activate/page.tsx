"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

function ActivateForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/reseller/activate", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token"), password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="auth-card" style={{ width: "min(440px, 100%)" }}>
        <h1>Activate access</h1>
        <p className="lead">Set a password to use the agencies included in your purchase.</p>
        {done ? (
          <p>
            Password saved. <Link href="/login">Sign in</Link>
          </p>
        ) : (
          <form className="form" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn lime block" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Activate account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="panel muted">Loading…</div>}>
      <ActivateForm />
    </Suspense>
  );
}
