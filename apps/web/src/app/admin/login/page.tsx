"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/lib/api";
import "./admin-login.css";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (!raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("/admin/login")) return "/admin";
  return raw;
}

function AdminLoginForm() {
  const { login, user, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user?.role === "ADMIN") {
      router.replace(nextPath || "/admin");
    }
  }, [user, loading, router, nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      if (loggedIn.role !== "ADMIN") {
        setError("This account does not have admin access.");
        await logout();
        return;
      }
      router.push(nextPath || "/admin");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Admin sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login-glow" aria-hidden />
      <div className="admin-login-grid" aria-hidden />

      <header className="admin-login-top">
        <Link href="/admin" className="admin-login-brand">
          <span className="admin-login-mark" aria-hidden>
            ▲
          </span>
          <span>
            AI Enterprise Studio
            <small>Control Plane</small>
          </span>
        </Link>
      </header>

      <main className="admin-login-main">
        <section className="admin-login-intro">
          <p className="admin-login-eyebrow">Admin console</p>
          <h1>Secure access to the platform control plane.</h1>
          <p>
            Manage catalog, commerce, entitlements, and Agency Wiki publishing — separated from the
            operator workspace.
          </p>

          <div className="admin-login-feature-grid">
            <article className="admin-login-feature">
              <span>01</span>
              <h3>Catalog & pricing</h3>
              <p>Products, bundles, and commercial controls.</p>
            </article>
            <article className="admin-login-feature">
              <span>02</span>
              <h3>Access & purchases</h3>
              <p>Entitlements, receipts, and payment status.</p>
            </article>
            <article className="admin-login-feature">
              <span>03</span>
              <h3>Wiki CMS</h3>
              <p>Publish shared operating knowledge safely.</p>
            </article>
          </div>
        </section>

        <section className="admin-login-card">
          <div className="admin-login-card-head">
            <h2>Admin sign-in</h2>
            <p>Authorized administrators only.</p>
          </div>

          <form className="admin-login-form" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Work email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
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
                placeholder="••••••••••••"
                required
              />
            </label>
            {error ? (
              <p className="admin-login-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="admin-login-submit" type="submit" disabled={submitting}>
              {submitting ? "Verifying…" : "Enter admin console"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-login">
          <div className="admin-login-card" style={{ margin: "auto" }}>
            Loading…
          </div>
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
