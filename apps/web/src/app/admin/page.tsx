"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ProductCard";
import { Protected } from "@/components/Protected";
import { apiFetch } from "@/lib/api";
import "./admin-dashboard.css";

interface AdminDashboard {
  stats: {
    users: number;
    products: number;
    publishedProducts: number;
    draftProducts: number;
    bundles: number;
    activeProductAccess: number;
    newInquiries: number;
    totalInquiries: number;
    resellerLeads: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    agencies?: string[];
  }>;
  recentProducts: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    shortDescription: string | null;
    icon: string | null;
  }>;
}

const STAT_META: Array<{
  key: keyof AdminDashboard["stats"];
  label: string;
  hint: string;
  tone: "lime" | "teal" | "ink" | "amber";
  href?: string;
}> = [
  { key: "users", label: "Customers", hint: "With unlocked agency access", tone: "lime", href: "/admin/users" },
  { key: "activeProductAccess", label: "Access grants", hint: "Active agency entitlements", tone: "ink", href: "/admin/users" },
  { key: "newInquiries", label: "New inquiries", hint: "Awaiting follow-up", tone: "amber", href: "/admin/inquiries" },
  { key: "totalInquiries", label: "Total inquiries", hint: "AES sales page leads", tone: "amber", href: "/admin/inquiries" },
  { key: "publishedProducts", label: "Published", hint: "Live agencies", tone: "lime", href: "/admin/products" },
  { key: "products", label: "Products", hint: "Agency catalog", tone: "teal", href: "/admin/products" },
  { key: "draftProducts", label: "Drafts", hint: "Not yet released", tone: "amber", href: "/admin/products" },
  { key: "bundles", label: "Bundles", hint: "Active commercial packs", tone: "teal", href: "/admin/bundles" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const dash = await apiFetch<AdminDashboard>("/api/admin/dashboard");
        setData(dash);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin dashboard");
      }
    })();
  }, []);

  return (
    <Protected adminOnly>
      <AdminShell>
        <div className="admin-dash">
          <PageHeader
            title="Overview"
            subtitle="Live counts for customers, inquiries, catalog, and access."
          />
          {error ? <p className="error">{error}</p> : null}

          {data ? (
            <div className="admin-dash-stack">
              <section className="admin-stat-grid" aria-label="Platform metrics">
                {STAT_META.map((item) => {
                  const value = data.stats[item.key] ?? 0;
                  const card = (
                    <article className={`admin-stat-card tone-${item.tone}`}>
                      <div className="admin-stat-top">
                        <span className="admin-stat-label">{item.label}</span>
                        <span className="admin-stat-dot" aria-hidden />
                      </div>
                      <strong className="admin-stat-value">{value}</strong>
                      <p className="admin-stat-hint">{item.hint}</p>
                    </article>
                  );
                  return item.href ? (
                    <Link key={item.key} href={item.href} className="admin-stat-link">
                      {card}
                    </Link>
                  ) : (
                    <div key={item.key}>{card}</div>
                  );
                })}
              </section>

              <section className="admin-split">
                <article className="admin-surface">
                  <div className="admin-surface-head">
                    <div>
                      <p className="admin-kicker">Catalog</p>
                      <h2>Recent products</h2>
                    </div>
                    <Link className="admin-text-link" href="/admin/products">
                      Manage →
                    </Link>
                  </div>
                  <ul className="admin-row-list">
                    {data.recentProducts.map((product) => (
                      <li key={product.id}>
                        <div className="admin-row-main">
                          <span className="admin-row-icon" aria-hidden>
                            {(product.icon || product.name.slice(0, 2)).toString().slice(0, 2)}
                          </span>
                          <div>
                            <Link href="/admin/products">
                              <strong>{product.name}</strong>
                            </Link>
                            <span className="admin-row-meta">
                              {product.shortDescription || product.slug}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={product.status} />
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="admin-surface">
                  <div className="admin-surface-head">
                    <div>
                      <p className="admin-kicker">Customers</p>
                      <h2>Recent accounts</h2>
                    </div>
                    <Link className="admin-text-link" href="/admin/users">
                      View all →
                    </Link>
                  </div>
                  {data.recentUsers.length === 0 ? (
                    <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                      No customers with agency access yet. Provision accounts from Inquiries.
                    </p>
                  ) : (
                    <ul className="admin-row-list">
                      {data.recentUsers.map((u) => (
                        <li key={u.id}>
                          <div className="admin-row-main">
                            <span className="admin-row-avatar" aria-hidden>
                              {`${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "U"}
                            </span>
                            <div>
                              <strong>
                                {u.firstName} {u.lastName}
                              </strong>
                              <span className="admin-row-meta">
                                {u.email}
                                {u.agencies?.length ? ` · ${u.agencies.join(", ")}` : ""}
                              </span>
                            </div>
                          </div>
                          <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </section>
            </div>
          ) : (
            <div className="admin-surface muted">Loading admin overview…</div>
          )}
        </div>
      </AdminShell>
    </Protected>
  );
}
