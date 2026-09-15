"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import "../../../reseller/reseller.css";

type Offer = {
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  sellerName: string;
  products: Array<{ name: string; slug: string }>;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function ResellerCheckoutPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, loading, login, register } = useAuth();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    void apiFetch<Offer>(`/api/reseller/public/offers/${params.slug}`)
      .then(setOffer)
      .catch((err: Error) => setError(err.message || "Offer unavailable"));
  }, [params.slug]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{
        mode: "completed" | "checkout";
        saleCode: string;
        checkoutUrl: string | null;
        confirmationPath: string;
      }>(`/api/reseller/public/offers/${params.slug}/checkout`, { method: "POST", body: "{}" });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      router.push(result.confirmationPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create checkout");
    } finally {
      setBusy(false);
    }
  }

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register({ email, password, firstName, lastName });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please log in";
      setError(message.toLowerCase().includes("already") ? "This email already has an account. Please log in." : message);
      if (message.toLowerCase().includes("already")) setMode("login");
    } finally {
      setBusy(false);
    }
  }

  if (!offer && error) {
    return (
      <div className="reseller-public">
        <div className="reseller-public-card">
          <h1>Offer unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!offer) return <div className="reseller-public">Loading checkout…</div>;

  return (
    <div className="reseller-public">
      <div className="reseller-public-card reseller-checkout">
        <p className="reseller-kicker">{offer.sellerName}</p>
        <h1>{offer.title}</h1>
        <p className="reseller-meta">{offer.products.map((product) => product.name).join(", ")}</p>
        <p><strong>{money(offer.priceCents, offer.currency)}</strong></p>
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Checking session…</p> : null}
        {!loading && user ? (
          <div className="reseller-form">
            <p>Signed in as {user.email}. The price above is set by the seller and cannot be changed here.</p>
            <button className="btn lime" type="button" disabled={busy} onClick={() => void pay()}>
              {busy ? "Starting payment…" : "Continue to payment"}
            </button>
          </div>
        ) : null}
        {!loading && !user ? (
          <form className="reseller-form" onSubmit={(e) => void onAuth(e)}>
            <div className="reseller-subnav">
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
                Create account
              </button>
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                Log in
              </button>
            </div>
            {mode === "register" ? (
              <>
                <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label>
                <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label>
              </>
            ) : null}
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button className="btn lime" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in and continue" : "Create account and continue"}
            </button>
            <p className="reseller-meta">
              Already have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/r/${offer.slug}/checkout`)}`}>Sign in</Link>
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
