"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { ToastBanner, useToast } from "@/components/Toast";
import { apiFetch, getToken, getClientApiBase } from "@/lib/api";
import "../reseller.css";

const API_URL = getClientApiBase();

type Agency = {
  id: string;
  title: string;
  published: boolean;
  publicPath: string;
  wordpressUrl: string | null;
  wordpressPageUrl: string | null;
  product: { name: string };
  offer: { title: string } | null;
};

async function download(id: string, title: string, kind: "sales" | "agency") {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/reseller/agencies/${id}/download?kind=${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "sales" ? `${title}-sales-page.html` : `${title}-agency.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function EntitlementsPage() {
  const { toast, showToast } = useToast();
  const [rows, setRows] = useState<Agency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [wpTarget, setWpTarget] = useState<Agency | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUser, setWpUser] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpAsHomepage, setWpAsHomepage] = useState(true);
  const [wpBusy, setWpBusy] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);

  async function load() {
    setRows(await apiFetch<Agency[]>("/api/reseller/agencies"));
  }

  useEffect(() => {
    void load().catch((err: Error) => {
      setError(err.message);
      showToast(err.message, "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openWordPress(row: Agency) {
    setWpTarget(row);
    setWpSiteUrl(row.wordpressUrl || "");
    setWpUser("");
    setWpPassword("");
    setWpAsHomepage(true);
    setWpError(null);
  }

  function closeWordPress() {
    if (wpBusy) return;
    setWpTarget(null);
    setWpPassword("");
    setWpError(null);
  }

  async function publishWordPress(e: FormEvent) {
    e.preventDefault();
    if (!wpTarget) return;
    setWpBusy(true);
    setWpError(null);
    setError(null);
    try {
      const result = await apiFetch<Agency>(`/api/reseller/agencies/${wpTarget.id}/wordpress`, {
        method: "POST",
        body: JSON.stringify({
          siteUrl: wpSiteUrl.trim(),
          username: wpUser.trim(),
          appPassword: wpPassword,
          asHomepage: wpAsHomepage,
        }),
      });
      setRows((current) => current.map((row) => (row.id === result.id ? { ...row, ...result } : row)));
      showToast(
        wpAsHomepage
          ? "Sales page deployed on your domain homepage."
          : result.wordpressPageUrl
            ? "Sales page published to WordPress."
            : "WordPress page created.",
        "success"
      );
      setWpTarget(null);
      setWpPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "WordPress publish failed";
      setWpError(message);
      showToast(message, "error");
    } finally {
      setWpBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this saved agency? Inquiries for it will be removed.")) return;
    setError(null);
    try {
      await apiFetch(`/api/reseller/agencies/${id}`, { method: "DELETE" });
      showToast("Agency deleted.", "success");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete";
      setError(message);
      showToast(message, "error");
    }
  }

  async function runDownload(id: string, title: string, kind: "sales" | "agency") {
    const key = `${id}:${kind}`;
    setError(null);
    setDownloading(key);
    try {
      await download(id, title, kind);
      showToast(kind === "sales" ? "Sales page downloaded." : "Agency file downloaded.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      showToast(message, "error");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Saved agencies"
          subtitle="Agencies you saved from branding. Link, edit, download, or delete them here."
          actions={
            <Link className="btn lime" href="/reseller/branding">
              New agency
            </Link>
          }
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          <ToastBanner toast={toast} />
          {rows.length === 0 ? (
            <section className="reseller-card">
              <p className="reseller-meta">No saved agencies yet. Create one on the branding page.</p>
            </section>
          ) : null}
          <div className="reseller-offer-grid">
            {rows.map((row) => (
              <article className="reseller-card" key={row.id}>
                <p className="reseller-kicker">
                  {row.published ? "Published" : "Draft"} · {row.product.name}
                </p>
                <h2>{row.title}</h2>
                <p className="reseller-meta">
                  {row.offer ? `Offer: ${row.offer.title}` : "No offer attached"}
                </p>
                <div className="reseller-actions">
                  <button className="btn btn-sm" type="button" onClick={() => openWordPress(row)}>
                    Link sales page to WordPress
                  </button>
                  {row.wordpressPageUrl ? (
                    <a
                      className="btn ghost btn-sm"
                      href={row.wordpressPageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WordPress page
                    </a>
                  ) : null}
                  <Link className="btn ghost btn-sm" href={`/reseller/branding?id=${row.id}`}>
                    Edit
                  </Link>
                  <button
                    className="btn ghost btn-sm"
                    type="button"
                    disabled={downloading !== null}
                    onClick={() => void runDownload(row.id, row.title, "sales")}
                  >
                    {downloading === `${row.id}:sales` ? "Downloading…" : "Download sales"}
                  </button>
                  <button
                    className="btn ghost btn-sm"
                    type="button"
                    disabled={downloading !== null}
                    onClick={() => void runDownload(row.id, row.title, "agency")}
                  >
                    {downloading === `${row.id}:agency` ? "Downloading…" : "Download agency"}
                  </button>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void remove(row.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {wpTarget ? (
            <div
              className="reseller-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeWordPress();
              }}
            >
              <form
                className="reseller-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wp-modal-title"
                onSubmit={(e) => void publishWordPress(e)}
              >
                <div className="reseller-modal-head">
                  <div>
                    <p className="reseller-modal-kicker">WordPress</p>
                    <h3 id="wp-modal-title">Link sales page</h3>
                  </div>
                  <button
                    className="reseller-modal-close"
                    type="button"
                    aria-label="Close"
                    disabled={wpBusy}
                    onClick={closeWordPress}
                  >
                    ×
                  </button>
                </div>

                <div className="reseller-modal-body">
                  <div className="reseller-modal-agency">
                    <strong>{wpTarget.title}</strong>
                    <span>
                      Publishes the branded sales page for {wpTarget.product.name}. Use an Application
                      Password from WordPress → Users → Profile.
                    </span>
                  </div>

                  <div className="reseller-modal-section">
                    <p className="reseller-modal-section-title">Site</p>
                    <label>
                      WordPress site link
                      <input
                        type="url"
                        value={wpSiteUrl}
                        onChange={(e) => setWpSiteUrl(e.target.value)}
                        placeholder="https://yoursite.com"
                        required
                        autoFocus
                      />
                    </label>
                  </div>

                  <div className="reseller-modal-section">
                    <p className="reseller-modal-section-title">Access</p>
                    <div className="reseller-field-row">
                      <label>
                        Username
                        <input
                          type="text"
                          value={wpUser}
                          onChange={(e) => setWpUser(e.target.value)}
                          autoComplete="off"
                          required
                        />
                      </label>
                      <label>
                        Application password
                        <input
                          type="password"
                          value={wpPassword}
                          onChange={(e) => setWpPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                    </div>
                  </div>

                  <div className="reseller-modal-section">
                    <p className="reseller-modal-section-title">Destination</p>
                    <label
                      className={`reseller-modal-option${wpAsHomepage ? " is-on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={wpAsHomepage}
                        onChange={(e) => setWpAsHomepage(e.target.checked)}
                      />
                      <span>
                        <strong>Deploy as homepage on this domain</strong>
                        <em>
                          Sales page opens at your domain root. WordPress header and menu are hidden.
                          Needs an Administrator application password.
                        </em>
                        <span className="reseller-modal-url">
                          {wpAsHomepage
                            ? `${(wpSiteUrl || "https://yoursite.com").replace(/\/$/, "")}/`
                            : `${(wpSiteUrl || "https://yoursite.com").replace(/\/$/, "")}/…/`}
                        </span>
                      </span>
                    </label>
                  </div>

                  {wpError ? <p className="error">{wpError}</p> : null}
                </div>

                <div className="reseller-modal-foot">
                  <button className="btn ghost" type="button" disabled={wpBusy} onClick={closeWordPress}>
                    Cancel
                  </button>
                  <button className="btn lime" type="submit" disabled={wpBusy}>
                    {wpBusy
                      ? wpAsHomepage
                        ? "Deploying…"
                        : "Publishing…"
                      : wpAsHomepage
                        ? "Deploy on domain"
                        : "Publish sales page"}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
