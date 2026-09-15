"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { InquireSection } from "@/components/sales/InquireSection";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiClientError } from "@/lib/api";
import "@/components/sales/inquiry-form.css";
import "@/components/sales/sales.css";

type AgencyOpt = {
  id: string;
  name: string;
  slug: string;
  owned?: boolean;
  locked?: boolean;
};

function ContactPurchaseInner() {
  const { user } = useAuth();
  const search = useSearchParams();
  const focus = search.get("focus") || search.get("product") || "";

  const [agencies, setAgencies] = useState<AgencyOpt[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setEmail(user.email || "");
  }, [user]);

  useEffect(() => {
    void apiFetch<{ products: AgencyOpt[] }>("/api/products/library")
      .then((data) => {
        const list = data.products || [];
        setAgencies(list);
        if (focus && list.some((a) => a.slug === focus)) {
          setSelected([focus]);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [focus]);

  const selectedAgencies = useMemo(
    () => agencies.filter((a) => selected.includes(a.slug)),
    [agencies, selected]
  );

  function toggleAgency(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected.length) {
      setError("Select at least one agency to purchase.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const interest = selectedAgencies.map((a) => a.name).join(", ");
      const needLine = message.trim()
        ? message.trim()
        : `Requesting access to: ${interest}`;

      for (const agency of selectedAgencies) {
        await apiFetch("/api/sales/inquiries", {
          method: "POST",
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            company: company.trim() || undefined,
            message: needLine,
            productSlug: agency.slug,
            interest: agency.name,
          }),
        });
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send your request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inquiry-page" style={{ minHeight: "auto" }}>
      <InquireSection
        title={
          <>
            Tell us what you need.
            <span> We will unlock access.</span>
          </>
        }
        description="Select the agencies you want. Our team will follow up and unlock access — no payment on this page."
        bullets={[
          "Response by email from the AES team",
          "Choose one or more agencies",
          "Access unlocked after admin follow-up",
        ]}
      >
        {sent ? (
          <div className="inquiry-form inquiry-form--dark inquiry-form--success" role="status">
            <div className="inquiry-form-success-mark" aria-hidden>
              ✓
            </div>
            <p className="inquiry-form-success-title">Request sent</p>
            <p className="inquiry-form-success-copy">
              We received your purchase details and will email you shortly.
            </p>
            <p className="inquiry-form-note" style={{ marginTop: "0.75rem" }}>
              Requested: {selectedAgencies.map((a) => a.name).join(", ")}
            </p>
            <Link className="inquiry-form-submit" href="/products" style={{ marginTop: "0.85rem", display: "inline-flex" }}>
              Back to products
            </Link>
          </div>
        ) : (
          <form className="inquiry-form inquiry-form--dark" onSubmit={(e) => void onSubmit(e)} noValidate>
            <p className="inquiry-form-note">
              Share your purchase details and we will unlock access by email.
            </p>
            <div className="inquiry-form-grid">
              <label className="inquiry-field">
                <span>First name</span>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="inquiry-field">
                <span>Last name</span>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="inquiry-field inquiry-field--full">
                <span>Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="inquiry-field">
                <span>
                  Phone <em>(optional)</em>
                </span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </label>
              <label className="inquiry-field">
                <span>
                  Company <em>(optional)</em>
                </span>
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company" />
              </label>
              <div className="inquiry-field inquiry-field--full" style={{ gap: "0.45rem" }}>
                <span>What do you want to purchase?</span>
                <div className="inquiry-agency-list">
                  {agencies.map((agency) => (
                    <label key={agency.slug} className="inquiry-agency-option">
                      <input
                        type="checkbox"
                        checked={selected.includes(agency.slug)}
                        onChange={() => toggleAgency(agency.slug)}
                      />
                      <span>
                        <strong>{agency.name}</strong>
                        <em>{agency.owned ? "already unlocked" : "locked"}</em>
                      </span>
                    </label>
                  ))}
                  {agencies.length === 0 ? <p className="inquiry-form-note">Loading agencies…</p> : null}
                </div>
              </div>
              <label className="inquiry-field inquiry-field--full">
                <span>
                  Message <em>(optional)</em>
                </span>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Timeline, bundle interest, or other notes."
                />
              </label>
            </div>
            {error ? <p className="inquiry-form-error">{error}</p> : null}
            <div className="inquiry-form-actions">
              <button className="inquiry-form-submit" type="submit" disabled={busy || selected.length === 0}>
                {busy ? "Sending…" : "Send purchase details"}
              </button>
            </div>
          </form>
        )}
      </InquireSection>
    </div>
  );
}

export default function ContactPurchasePage() {
  return (
    <Protected>
      <AppShell>
        <Suspense fallback={<div className="panel muted">Loading…</div>}>
          <ContactPurchaseInner />
        </Suspense>
      </AppShell>
    </Protected>
  );
}
