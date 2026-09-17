"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ToastBanner, useToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiClientError } from "@/lib/api";
import "./contact.css";

type AgencyOpt = {
  id: string;
  name: string;
  slug: string;
  owned?: boolean;
  locked?: boolean;
};

function ContactPurchaseInner() {
  const { user } = useAuth();
  const { toast, showToast } = useToast();
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
  const [loadingAgencies, setLoadingAgencies] = useState(true);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setEmail(user.email || "");
  }, [user]);

  useEffect(() => {
    setLoadingAgencies(true);
    void apiFetch<{ products: AgencyOpt[] }>("/api/products/library")
      .then((data) => {
        const list = data.products || [];
        setAgencies(list);
        setSelected((prev) => {
          const unlockedOnly = prev.filter((slug) => list.some((a) => a.slug === slug && !a.owned));
          if (focus && list.some((a) => a.slug === focus && !a.owned)) {
            return unlockedOnly.includes(focus) ? unlockedOnly : [...unlockedOnly, focus];
          }
          return unlockedOnly;
        });
      })
      .catch((err: Error) => {
        setError(err.message);
        showToast(err.message, "error");
      })
      .finally(() => setLoadingAgencies(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const selectedAgencies = useMemo(
    () => agencies.filter((a) => selected.includes(a.slug) && !a.owned),
    [agencies, selected]
  );

  const lockedCount = useMemo(() => agencies.filter((a) => !a.owned).length, [agencies]);

  function toggleAgency(slug: string) {
    const agency = agencies.find((a) => a.slug === slug);
    if (agency?.owned) return;
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected.length) {
      setError("Select at least one agency to purchase.");
      showToast("Select at least one agency.", "error");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const interest = selectedAgencies.map((a) => a.name).join(", ");
      const needLine = message.trim() ? message.trim() : `Requesting access to: ${interest}`;

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
      showToast("Purchase request sent.", "success");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Could not send your request";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-page">
      <ToastBanner toast={toast} />
      <PageHeader
        title="Request access"
        subtitle="Choose agencies and send purchase details. No payment is collected here — AES unlocks access after follow-up."
        actions={
          <Link className="btn ghost" href="/products">
            My products
          </Link>
        }
      />

      {sent ? (
        <section className="contact-success panel">
          <div className="contact-success-mark" aria-hidden>
            ✓
          </div>
          <h2>Request sent</h2>
          <p>
            We received your purchase details for{" "}
            <strong>{selectedAgencies.map((a) => a.name).join(", ")}</strong> and will email you
            shortly.
          </p>
          <div className="contact-success-actions">
            <Link className="btn lime" href="/products">
              Back to products
            </Link>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setSent(false);
                setSelected(focus ? [focus] : []);
                setMessage("");
              }}
            >
              Request another
            </button>
          </div>
        </section>
      ) : (
        <div className="contact-layout">
          <aside className="contact-aside panel">
            <p className="contact-kicker">Purchase request</p>
            <h2>
              Tell us what you need.
              <span> We unlock access.</span>
            </h2>
            <p className="contact-lead">
              Select one or more agencies. Our team follows up by email — nothing is charged on this
              page.
            </p>
            <ul className="contact-points">
              <li>Response by email from the AES team</li>
              <li>
                {lockedCount > 0
                  ? `${lockedCount} locked agenc${lockedCount === 1 ? "y" : "ies"} available to request`
                  : "All listed agencies are already unlocked"}
              </li>
              <li>Access unlocked after admin follow-up</li>
            </ul>
            {selectedAgencies.length > 0 ? (
              <div className="contact-selected">
                <span>Selected</span>
                <strong>
                  {selectedAgencies.length} agenc{selectedAgencies.length === 1 ? "y" : "ies"}
                </strong>
              </div>
            ) : null}
          </aside>

          <form className="contact-form panel" onSubmit={(e) => void onSubmit(e)} noValidate>
            <div className="contact-form-head">
              <h3>Your details</h3>
              <p>Prefilled from your account. Edit if needed.</p>
            </div>

            <div className="contact-grid">
              <label className="contact-field">
                <span>First name</span>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="contact-field">
                <span>Last name</span>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="contact-field contact-field--full">
                <span>Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="contact-field">
                <span>
                  Phone <em>optional</em>
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </label>
              <label className="contact-field">
                <span>
                  Company <em>optional</em>
                </span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your company"
                />
              </label>
            </div>

            <div className="contact-agencies">
              <div className="contact-form-head">
                <h3>Agencies to purchase</h3>
                <p>Select locked agencies you want unlocked. Already unlocked items stay available for notes.</p>
              </div>
              <div className="contact-agency-list" role="group" aria-label="Agencies">
                {loadingAgencies ? <p className="muted">Loading agencies…</p> : null}
                {!loadingAgencies && agencies.length === 0 ? (
                  <p className="muted">No agencies available right now.</p>
                ) : null}
                {agencies.map((agency) => {
                  const active = selected.includes(agency.slug);
                  const owned = Boolean(agency.owned);
                  return (
                    <button
                      key={agency.slug}
                      type="button"
                      className={`contact-agency${!owned && active ? " is-on" : ""}${owned ? " is-owned" : ""}`}
                      onClick={() => toggleAgency(agency.slug)}
                      aria-pressed={owned ? undefined : active}
                      disabled={owned}
                      title={owned ? "Already unlocked — cannot select" : undefined}
                    >
                      <span className="contact-agency-check" aria-hidden>
                        {owned ? "✓" : active ? "✓" : ""}
                      </span>
                      <span className="contact-agency-copy">
                        <strong>{agency.name}</strong>
                        <em>{owned ? "Already unlocked" : "Locked — request access"}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="contact-field contact-field--full">
              <span>
                Message <em>optional</em>
              </span>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Timeline, bundle interest, or other notes."
              />
            </label>

            {error ? <p className="error">{error}</p> : null}

            <div className="contact-actions">
              <button className="btn lime" type="submit" disabled={busy || selected.length === 0}>
                {busy ? "Sending…" : "Send purchase details"}
              </button>
              <p className="muted">
                {selected.length === 0
                  ? "Select at least one agency to continue."
                  : `Sending request for ${selected.length} agenc${selected.length === 1 ? "y" : "ies"}.`}
              </p>
            </div>
          </form>
        </div>
      )}
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
