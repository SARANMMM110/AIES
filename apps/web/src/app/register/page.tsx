"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/lib/api";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (
    raw === "/sales" ||
    raw.startsWith("/sales/") ||
    raw === "/purchase" ||
    raw.startsWith("/purchase?") ||
    raw.startsWith("/purchase/")
  ) {
    return null;
  }
  return raw;
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      router.push(nextPath || "/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <div className="auth-visual-brand">
          <span className="brand-mark">AES</span>
          AI Enterprise Studio
        </div>
        <div className="auth-visual-copy">
          <h2>Build your agency operating system in minutes.</h2>
          <p>
            Create an account to access assigned products, manage clients, and run guided workflows with
            human review.
          </p>
        </div>
        <ul className="auth-visual-points">
          <li>Secure per-product access control</li>
          <li>Client and project workspace</li>
          <li>Export standalone agency tools</li>
        </ul>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="lead">Register as a platform user to get started.</p>
          <form className="form" onSubmit={(e) => void onSubmit(e)}>
            <label>
              First name
              <input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </label>
            <label>
              Last name
              <input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                minLength={8}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn block lime" type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="auth-footer">
            Already registered? <Link href={loginHref}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-page">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
