"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
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
  const [rows, setRows] = useState<Agency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setRows(await apiFetch<Agency[]>("/api/reseller/agencies"));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this saved agency? Inquiries for it will be removed.")) return;
    setError(null);
    try {
      await apiFetch(`/api/reseller/agencies/${id}`, { method: "DELETE" });
      setNotice("Agency deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function copyLink(path: string) {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setNotice("Sales page link copied. Paste it into WordPress, or publish directly from Branding.");
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Saved agencies"
          subtitle="Agencies you saved from branding. Link, edit, download, or delete them here."
          actions={<Link className="btn lime" href="/reseller/branding">New agency</Link>}
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="success">{notice}</p> : null}
          {rows.length === 0 ? <section className="reseller-card"><p className="reseller-meta">No saved agencies yet. Create one on the branding page.</p></section> : null}
          <div className="reseller-offer-grid">
            {rows.map((row) => (
              <article className="reseller-card" key={row.id}>
                <p className="reseller-kicker">{row.published ? "Published" : "Draft"} · {row.product.name}</p>
                <h2>{row.title}</h2>
                <p className="reseller-meta">{row.offer ? `Offer: ${row.offer.title}` : "No offer attached"}</p>
                <div className="reseller-actions">
                  <button className="btn btn-sm" type="button" onClick={() => void copyLink(row.publicPath)}>Link to WordPress</button>
                  {row.wordpressPageUrl ? <a className="btn ghost btn-sm" href={row.wordpressPageUrl} target="_blank" rel="noreferrer">Open WordPress page</a> : null}
                  <Link className="btn ghost btn-sm" href={`/reseller/branding?id=${row.id}`}>Edit</Link>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void download(row.id, row.title, "sales").catch((err: Error) => setError(err.message))}>Download sales</button>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void download(row.id, row.title, "agency").catch((err: Error) => setError(err.message))}>Download agency</button>
                  <button className="btn ghost btn-sm" type="button" onClick={() => void remove(row.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}
