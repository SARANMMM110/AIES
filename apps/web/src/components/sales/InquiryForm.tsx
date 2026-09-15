"use client";

import { FormEvent, useState } from "react";
import "./inquiry-form.css";

export type InquiryValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
};

type Props = {
  variant?: "light" | "dark";
  ctaLabel?: string;
  note?: string | null;
  successMessage?: string;
  className?: string;
  onSubmit: (values: InquiryValues) => Promise<void>;
};

const EMPTY: InquiryValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  message: "",
};

export function InquiryForm({
  variant = "dark",
  ctaLabel = "Send purchase details",
  note = null,
  successMessage = "Details received. Our team will email you shortly.",
  className,
  onSubmit,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InquiryValues>(EMPTY);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        message: form.message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your details");
    } finally {
      setBusy(false);
    }
  }

  const root = ["inquiry-form", `inquiry-form--${variant}`, className].filter(Boolean).join(" ");

  if (sent) {
    return (
      <div className={`${root} inquiry-form--success`} role="status">
        <div className="inquiry-form-success-mark" aria-hidden>
          ✓
        </div>
        <p className="inquiry-form-success-title">Inquiry sent</p>
        <p className="inquiry-form-success-copy">{successMessage}</p>
      </div>
    );
  }

  return (
    <form className={root} onSubmit={(e) => void handleSubmit(e)} noValidate>
      {note ? <p className="inquiry-form-note">{note}</p> : null}
      <div className="inquiry-form-grid">
        <label className="inquiry-field">
          <span>First name</span>
          <input
            name="firstName"
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
            placeholder="Jane"
          />
        </label>
        <label className="inquiry-field">
          <span>Last name</span>
          <input
            name="lastName"
            autoComplete="family-name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
            placeholder="Smith"
          />
        </label>
        <label className="inquiry-field inquiry-field--full">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="you@company.com"
          />
        </label>
        <label className="inquiry-field">
          <span>
            Phone <em>(optional)</em>
          </span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 555 000 0000"
          />
        </label>
        <label className="inquiry-field">
          <span>
            Company <em>(optional)</em>
          </span>
          <input
            name="company"
            autoComplete="organization"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="Your company"
          />
        </label>
        <label className="inquiry-field inquiry-field--full">
          <span>
            Message <em>(optional)</em>
          </span>
          <textarea
            name="message"
            rows={3}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Goals, timeline, or questions."
          />
        </label>
      </div>
      {error ? <p className="inquiry-form-error">{error}</p> : null}
      <div className="inquiry-form-actions">
        <button className="inquiry-form-submit" type="submit" disabled={busy}>
          {busy ? "Sending…" : ctaLabel}
        </button>
      </div>
    </form>
  );
}
