"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { ResellerGate } from "@/components/ResellerGate";
import { ResellerNav } from "@/components/ResellerNav";
import { apiFetch, getToken, getClientApiBase } from "@/lib/api";
import { ToastBanner, useToast } from "@/components/Toast";
import "../reseller.css";

const API_URL = getClientApiBase();

type Choice = { id: string; name?: string; title?: string; status?: string };
type Saved = {
  id: string;
  title: string;
  product: { id: string; name: string };
  offer: { id: string; title: string } | null;
  brandName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  footerText: string | null;
  wordpressUrl: string | null;
  wordpressPageUrl: string | null;
  published: boolean;
  publicPath: string;
};

type AccountBrand = {
  brandName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  footerText: string | null;
};

const EMPTY = {
  productId: "",
  offerId: "",
  title: "",
  brandName: "",
  logoPath: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#12324a",
  secondaryColor: "#c8f04d",
  supportEmail: "",
  supportPhone: "",
  footerText: "",
  wordpressUrl: "",
  published: false,
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function assetPathFromUrl(url: string | null | undefined) {
  if (!url) return "";
  return url.replace(API_URL, "").replace(/^https?:\/\/[^/]+/, "").split("?")[0] || "";
}

function withCacheBust(url: string) {
  if (!url) return "";
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${Date.now()}`;
}

function BrandingForm() {
  const search = useSearchParams();
  const editId = search.get("id");
  const { toast, showToast } = useToast();
  const [products, setProducts] = useState<Choice[]>([]);
  const [offers, setOffers] = useState<Choice[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wpUser, setWpUser] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpAsHomepage, setWpAsHomepage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<"sales" | "agency" | null>(null);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const localPreviewRef = useRef<{ logo?: string; favicon?: string }>({});

  function revokeLocal(kind: "logo" | "favicon") {
    const current = localPreviewRef.current[kind];
    if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
    delete localPreviewRef.current[kind];
  }

  useEffect(() => {
    return () => {
      revokeLocal("logo");
      revokeLocal("favicon");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void apiFetch<{ products: Choice[]; offers: Choice[] }>("/api/reseller/agencies/choices")
      .then((data) => {
        setProducts(data.products);
        setOffers(data.offers);
      })
      .catch((err: Error) => setError(err.message));

    void apiFetch<{ branding: AccountBrand }>("/api/reseller/branding")
      .then((data) => {
        const brand = data.branding;
        if (!brand) return;
        setForm((prev) => ({
          ...prev,
          brandName: prev.brandName || brand.brandName || "",
          logoUrl: prev.logoUrl || (brand.logoUrl ? withCacheBust(brand.logoUrl) : ""),
          logoPath: prev.logoPath || assetPathFromUrl(brand.logoUrl),
          faviconUrl: prev.faviconUrl || (brand.faviconUrl ? withCacheBust(brand.faviconUrl) : ""),
          primaryColor: prev.primaryColor || brand.primaryColor || "#12324a",
          secondaryColor: prev.secondaryColor || brand.secondaryColor || "#c8f04d",
          supportEmail: prev.supportEmail || brand.supportEmail || "",
          supportPhone: prev.supportPhone || brand.supportPhone || "",
          footerText: prev.footerText || brand.footerText || "",
        }));
      })
      .catch(() => {
        /* account branding is optional */
      });
  }, []);

  useEffect(() => {
    if (!editId) return;
    void apiFetch<Saved[]>("/api/reseller/agencies")
      .then((rows) => {
        const row = rows.find((item) => item.id === editId);
        if (!row) return;
        setSaved(row);
        setForm((prev) => ({
          ...prev,
          productId: row.product.id,
          offerId: row.offer?.id || "",
          title: row.title,
          brandName: row.brandName || prev.brandName || "",
          // Keep a freshly uploaded / account logo if this agency row has none yet
          logoPath: row.logoUrl ? assetPathFromUrl(row.logoUrl) : prev.logoPath,
          logoUrl: row.logoUrl ? withCacheBust(row.logoUrl) : prev.logoUrl,
          primaryColor: row.primaryColor || prev.primaryColor || "#12324a",
          secondaryColor: row.secondaryColor || prev.secondaryColor || "#c8f04d",
          supportEmail: row.supportEmail || prev.supportEmail || "",
          supportPhone: row.supportPhone || prev.supportPhone || "",
          footerText: row.footerText || prev.footerText || "",
          wordpressUrl: row.wordpressUrl || "",
          published: row.published,
        }));
      })
      .catch((err: Error) => setError(err.message));
  }, [editId]);

  async function uploadAsset(kind: "logo" | "favicon", file: File | null) {
    if (!file) return;
    setUploading(kind);
    setError(null);
    setNotice(null);

    // Instant local preview — do not wait for the API round-trip
    revokeLocal(kind);
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current[kind] = localUrl;
    setForm((prev) =>
      kind === "logo" ? { ...prev, logoUrl: localUrl } : { ...prev, faviconUrl: localUrl }
    );

    try {
      const dataUrl = await fileToDataUrl(file);
      if (kind === "logo") {
        const result = await apiFetch<{ logoUrl: string }>("/api/reseller/branding/logo", {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
        if (!result?.logoUrl) throw new Error("Upload succeeded but no logo URL was returned");
        const logoPath = assetPathFromUrl(result.logoUrl);
        const remote = withCacheBust(result.logoUrl);
        setForm((prev) => ({ ...prev, logoUrl: remote, logoPath }));
        revokeLocal("logo");
        setNotice("Logo uploaded. Save to apply it to this agency.");
        showToast("Logo uploaded.", "success");
      } else {
        const result = await apiFetch<{ faviconUrl: string }>("/api/reseller/branding/favicon", {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
        if (!result?.faviconUrl) throw new Error("Upload succeeded but no favicon URL was returned");
        const remote = withCacheBust(result.faviconUrl);
        setForm((prev) => ({ ...prev, faviconUrl: remote }));
        revokeLocal("favicon");
        setNotice("Favicon uploaded.");
        showToast("Favicon uploaded.", "success");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      showToast(message, "error");
      // Keep the local preview so the user still sees what they picked
    } finally {
      setUploading(null);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        productId: form.productId,
        offerId: form.offerId || null,
        title: form.title,
        brandName: form.brandName,
        logoPath: form.logoPath || null,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        footerText: form.footerText,
        wordpressUrl: form.wordpressUrl || null,
        published: form.published,
      };
      // Keep account-level brand fields in sync for white-label pages.
      const [, result] = await Promise.all([
        apiFetch("/api/reseller/branding", {
          method: "PUT",
          body: JSON.stringify({
            brandName: form.brandName,
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            supportEmail: form.supportEmail,
            supportPhone: form.supportPhone,
            footerText: form.footerText,
          }),
        }).catch(() => null),
        apiFetch<Saved>(saved ? `/api/reseller/agencies/${saved.id}` : "/api/reseller/agencies", {
          method: saved ? "PUT" : "POST",
          body: JSON.stringify(body),
        }),
      ]);
      setSaved(result);
      setForm((prev) => ({
        ...prev,
        logoUrl: result.logoUrl ? withCacheBust(result.logoUrl) : prev.logoUrl,
        logoPath: result.logoUrl ? assetPathFromUrl(result.logoUrl) : prev.logoPath,
      }));
      const msg = result.published ? "Agency saved and published." : "Saved.";
      setNotice(msg);
      showToast(msg, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save agency";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function download(kind: "sales" | "agency") {
    if (!saved) return;
    setError(null);
    setDownloading(kind);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/reseller/agencies/${saved.id}/download?kind=${kind}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setError("Download failed");
        showToast("Download failed", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "sales" ? `${saved.title}-sales-page.html` : `${saved.title}-agency.html`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(kind === "sales" ? "Sales page downloaded." : "Agency file downloaded.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      showToast(message, "error");
    } finally {
      setDownloading(null);
    }
  }

  async function publishWordPress() {
    if (!saved) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<Saved>(`/api/reseller/agencies/${saved.id}/wordpress`, {
        method: "POST",
        body: JSON.stringify({
          siteUrl: form.wordpressUrl,
          username: wpUser,
          appPassword: wpPassword,
          asHomepage: wpAsHomepage,
        }),
      });
      setSaved(result);
      setWpPassword("");
      const msg = wpAsHomepage
        ? `Sales page deployed on domain: ${result.wordpressPageUrl || form.wordpressUrl}`
        : result.wordpressPageUrl
          ? `Published to WordPress: ${result.wordpressPageUrl}`
          : "WordPress page created.";
      setNotice(msg);
      showToast(wpAsHomepage ? "Deployed on domain homepage." : "Published to WordPress.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "WordPress publish failed";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Protected>
      <AppShell>
        <PageHeader
          title="Branding"
          subtitle="Choose an agency, add your logo and brand details, then save. Publishing and WordPress are optional."
        />
        <ResellerGate>
          <ResellerNav />
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="success">{notice}</p> : null}
          <ToastBanner toast={toast} />
          <form className="reseller-layout" onSubmit={(e) => void onSave(e)}>
            <section className="reseller-card reseller-form">
              <h2>Agency</h2>
              <label>
                Choose agency
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
                  <option value="">Select an agency</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="How this agency should be named"
                />
              </label>
              <label>
                Apply an existing offer
                <select value={form.offerId} onChange={(e) => setForm({ ...form, offerId: e.target.value })}>
                  <option value="">No offer</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="reseller-note">
                If you select an offer, that offer’s title, copy, and button text are used on this
                agency’s sales page and downloads.
                visitors leave their details and you email them.
              </p>

              <h2>Brand details</h2>
              <label>
                Brand name
                <input
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="Shown on your sales page"
                />
              </label>

              <div className="reseller-asset-field">
                <span>Logo</span>
                <div className="reseller-asset-row">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="reseller-asset-preview logo" src={form.logoUrl} alt="Logo preview" />
                  ) : (
                    <div className="reseller-asset-empty">No logo yet</div>
                  )}
                  <label className="reseller-file-btn">
                    {uploading === "logo" ? "Uploading…" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                      disabled={uploading !== null || busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        e.target.value = "";
                        void uploadAsset("logo", file);
                      }}
                    />
                  </label>
                </div>
                <p className="reseller-note">PNG, JPEG, or WebP. Used on your agency sales page header.</p>
              </div>

              <div className="reseller-asset-field">
                <span>Favicon</span>
                <div className="reseller-asset-row">
                  {form.faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="reseller-asset-preview favicon" src={form.faviconUrl} alt="Favicon preview" />
                  ) : (
                    <div className="reseller-asset-empty small">No favicon</div>
                  )}
                  <label className="reseller-file-btn">
                    {uploading === "favicon" ? "Uploading…" : "Upload favicon"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico"
                      disabled={uploading !== null || busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        e.target.value = "";
                        void uploadAsset("favicon", file);
                      }}
                    />
                  </label>
                </div>
                <p className="reseller-note">Optional browser tab icon (ICO, PNG, or WebP).</p>
              </div>

              <label>
                Support email
                <input
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  placeholder="hello@yourbrand.com"
                />
              </label>
              <label>
                Phone
                <input
                  value={form.supportPhone}
                  onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                  placeholder="Optional contact number"
                />
              </label>

              <div className="reseller-color-grid">
                <label>
                  Primary color
                  <span className="reseller-color-row">
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      aria-label="Primary color picker"
                    />
                    <input
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    />
                  </span>
                </label>
                <label>
                  Secondary color
                  <span className="reseller-color-row">
                    <input
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                      aria-label="Secondary color picker"
                    />
                    <input
                      value={form.secondaryColor}
                      onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    />
                  </span>
                </label>
              </div>

              <label>
                Footer text
                <input
                  value={form.footerText}
                  onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                  placeholder="Short line under the inquiry form"
                />
              </label>

              <button className="btn lime" type="submit" disabled={busy || uploading !== null}>
                {busy ? "Saving…" : "Save"}
              </button>
            </section>

            <section className="reseller-card reseller-form">
              <h2>Downloads and WordPress</h2>
              <p className="reseller-note">
                Save first. Sales page downloads branded HTML that sends purchase details to your Customers
                tab and email. Downloading a sales page also publishes it for inquiries.
              </p>
              <div className="reseller-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={!saved || downloading !== null}
                  onClick={() => void download("sales")}
                >
                  {downloading === "sales" ? "Downloading…" : "Download sales page"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={!saved || downloading !== null}
                  onClick={() => void download("agency")}
                >
                  {downloading === "agency" ? "Downloading…" : "Download agency page"}
                </button>
              </div>
              <label>
                WordPress site link
                <input
                  value={form.wordpressUrl}
                  onChange={(e) => setForm({ ...form, wordpressUrl: e.target.value })}
                  placeholder="https://yoursite.com"
                />
              </label>
              <h2>Link sales page to WordPress</h2>
              <p className="reseller-note">
                Optional. Publishes your branded sales page to WordPress (not an iframe wrapper). Uses
                an application password for this request only — it is not stored.
              </p>
              <label>
                WordPress username
                <input value={wpUser} onChange={(e) => setWpUser(e.target.value)} autoComplete="off" />
              </label>
              <label>
                Application password
                <input
                  type="password"
                  value={wpPassword}
                  onChange={(e) => setWpPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={wpAsHomepage}
                  onChange={(e) => setWpAsHomepage(e.target.checked)}
                  style={{ marginTop: "0.2rem" }}
                />
                <span>
                  Deploy as homepage on this domain
                  <span className="reseller-note" style={{ display: "block", marginTop: 4 }}>
                    Sales page opens at your domain root (https://yoursite.com/). Requires an
                    Administrator application password.
                  </span>
                </span>
              </label>
              <button
                className="btn ghost"
                type="button"
                disabled={!saved || busy}
                onClick={() => void publishWordPress()}
              >
                {wpAsHomepage ? "Deploy sales page on domain" : "Publish sales page to WordPress"}
              </button>
              {saved?.wordpressPageUrl ? <p className="success">WordPress page: {saved.wordpressPageUrl}</p> : null}
            </section>
          </form>
        </ResellerGate>
      </AppShell>
    </Protected>
  );
}

export default function BrandingPage() {
  return (
    <Suspense fallback={<div className="panel muted">Loading branding…</div>}>
      <BrandingForm />
    </Suspense>
  );
}
