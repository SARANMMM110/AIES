"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/lib/api";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Public marketing pages should not override the post-login home destination.
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

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (nextPath) {
      // Admin console has its own login — never send operators into /admin from /login
      if (nextPath.startsWith("/admin")) {
        router.replace(`/admin/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }
      router.replace(nextPath);
      return;
    }
    router.replace("/dashboard");
  }, [user, loading, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      if (nextPath?.startsWith("/admin")) {
        router.push(`/admin/login?next=${encodeURIComponent(nextPath)}`);
      } else if (nextPath) {
        router.push(nextPath);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden={false}>
        <div className="auth-visual-brand">
          <span className="brand-mark">AES</span>
          AI Enterprise Studio
        </div>
        <div className="auth-visual-copy">
          <h2>Run every agency product from one premium workspace.</h2>
          <p>
            Access guided workflows, client context, and exportable standalone tools — with clear ownership
            and review at every step.
          </p>
        </div>
        <ul className="auth-visual-points">
          <li>Independent agency products, one studio</li>
          <li>Human-reviewed AI workflow engine</li>
          <li>Downloadable HTML tools for offline use</li>
        </ul>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="lead">Sign in with the credentials provided by your administrator.</p>
          <form className="form" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn block lime" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
