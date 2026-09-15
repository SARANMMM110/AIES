"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { apiFetch, ApiClientError } from "@/lib/api";

type ProductOpt = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

function ProvisionInner() {
  const router = useRouter();
  const search = useSearchParams();

  const inquiryId = search.get("inquiryId") || "";
  const prefillEmail = search.get("email") || "";
  const prefillFirst = search.get("firstName") || "";
  const prefillLast = search.get("lastName") || "";
  const prefillProductIds = useMemo(() => {
    const raw = search.get("productIds") || search.get("productId") || "";
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }, [search]);

  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [email, setEmail] = useState(prefillEmail);
  const [firstName, setFirstName] = useState(prefillFirst);
  const [lastName, setLastName] = useState(prefillLast);
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<string[]>(prefillProductIds);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string; password: string; agencies: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void apiFetch<{ products: ProductOpt[] }>("/api/products")
      .then((data) =>
        setProducts(
          (data.products || []).filter((p) => p.status !== "ARCHIVED").sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (prefillProductIds.length) setSelected(prefillProductIds);
  }, [prefillProductIds]);

  function toggleProduct(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

  const credentialsBox = done
    ? [`Login: ${loginUrl}`, `Username: ${done.email}`, `Password: ${done.password}`].join("\n")
    : "";

  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(credentialsBox);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<{
        user: { email: string };
        agencies: Array<{ name: string }>;
      }>("/api/users/provision", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          productIds: selected,
          inquiryId: inquiryId || null,
          notifyCustomer,
        }),
      });
      setDone({
        email: result.user.email,
        password,
        agencies: result.agencies.map((a) => a.name),
      });
      setCopied(false);
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Create customer account"
        subtitle="Set login credentials and unlock agency access. The customer can change their password later from Account settings."
        actions={
          <Link className="btn ghost" href={inquiryId ? "/admin/inquiries" : "/admin/users"}>
            Back
          </Link>
        }
      />

      {error ? <p className="error">{error}</p> : null}

      {done ? (
        <div className="panel stack" style={{ maxWidth: 520 }}>
          <p style={{ marginTop: 0 }}>Account created. Send these login details to the customer.</p>

          <textarea
            readOnly
            rows={4}
            value={credentialsBox}
            aria-label="Login credentials"
            style={{
              width: "100%",
              resize: "none",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 14,
              lineHeight: 1.5,
              padding: "0.85rem 1rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          />

          <button type="button" className="btn lime" onClick={() => void copyCredentials()}>
            {copied ? "Copied" : "Copy"}
          </button>

          <p className="muted" style={{ marginBottom: 0 }}>
            Agencies unlocked: {done.agencies.join(", ") || "—"}
          </p>
          {notifyCustomer ? (
            <p className="muted" style={{ marginTop: 0 }}>
              A welcome email with login details was also queued for the customer.
            </p>
          ) : null}

          <div className="reseller-actions">
            <button type="button" className="btn" onClick={() => router.push("/admin/users")}>
              View users
            </button>
            <Link className="btn ghost" href="/admin/inquiries">
              Back to inquiries
            </Link>
          </div>
        </div>
      ) : (
        <form className="panel stack" onSubmit={onSubmit}>
          {inquiryId ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Linked to inquiry <code>{inquiryId}</code> — status becomes CONTACTED after create.
            </p>
          ) : null}

          <label className="stack" style={{ gap: 6 }}>
            <span>Email / username</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="reseller-filters" style={{ alignItems: "end" }}>
            <label className="stack" style={{ gap: 6, flex: 1 }}>
              <span>First name</span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="stack" style={{ gap: 6, flex: 1 }}>
              <span>Last name</span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>

          <label className="stack" style={{ gap: 6 }}>
            <span>Temporary password</span>
            <input
              required
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters, include a letter and number"
              autoComplete="new-password"
            />
          </label>

          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 10 }}>
            <legend style={{ fontWeight: 600, marginBottom: 4 }}>Agency access</legend>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Select the agencies this customer can use on the Products page after login.
            </p>
            <div className="stack" style={{ gap: 8 }}>
              {products.map((product) => (
                <label
                  key={product.id}
                  style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(product.id)}
                    onChange={() => toggleProduct(product.id)}
                  />
                  <span>
                    {product.name}
                    <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                      {product.slug}
                    </span>
                  </span>
                </label>
              ))}
              {products.length === 0 ? <p className="muted">No agencies available.</p> : null}
            </div>
          </fieldset>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
            />
            <span>Email the customer their login details</span>
          </label>

          <div className="reseller-actions">
            <button className="btn lime" type="submit" disabled={busy || selected.length === 0}>
              {busy ? "Creating…" : "Create account & unlock access"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default function AdminProvisionUserPage() {
  return (
    <Protected adminOnly>
      <AdminShell>
        <Suspense fallback={<div className="panel muted">Loading…</div>}>
          <ProvisionInner />
        </Suspense>
      </AdminShell>
    </Protected>
  );
}
