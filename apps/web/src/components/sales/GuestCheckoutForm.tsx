"use client";

import { useState } from "react";

export type GuestAccountFields = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

type Props = {
  onSubmit: (account: GuestAccountFields) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  title?: string;
  subtitle?: string;
};

export function GuestCheckoutForm({
  onSubmit,
  busy,
  error,
  submitLabel = "Create account & complete purchase",
  title = "Create your account",
  subtitle = "Your account is created when you purchase. You’ll only see the agencies you buy.",
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <form
      className="guest-checkout"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ email, password, firstName, lastName });
      }}
      style={{ display: "grid", gap: 10, marginTop: 12 }}
    >
      <div>
        <strong>{title}</strong>
        <p className="sales-note" style={{ margin: "4px 0 0" }}>
          {subtitle}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label>
          First name
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label>
          Last name
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </label>
      </div>
      <label>
        Email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label>
        Password
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters, letter + number"
        />
      </label>
      {error ? (
        <p className="sales-toast error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn lime" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Creating account…" : submitLabel}
      </button>
      <p className="sales-note" style={{ margin: 0 }}>
        Already have an account?{" "}
        <a href={`/login?next=${encodeURIComponent("/purchase")}`}>Sign in</a>
      </p>
    </form>
  );
}
