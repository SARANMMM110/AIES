"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { TablePagination } from "@/components/TablePagination";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useClientPagination } from "@/hooks/useClientPagination";

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  displayOrder: number;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  _count: { relatedAgencies: number; relatedWorkflows: number; relatedFrom: number };
};

type Category = { id: string; name: string; slug: string };

export default function AdminWikiPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [appliedKey, setAppliedKey] = useState("::");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pager = useClientPagination(articles, { resetKey: appliedKey });

  async function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const data = await apiFetch<{ articles: ArticleRow[]; categories: Category[] }>(
      `/api/wiki/admin/articles?${params}`
    );
    setArticles(data.articles);
    setCategories(data.categories);
    setAppliedKey(`${q.trim()}::${status}`);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load wiki admin")
    );
  }, []);

  async function setArticleStatus(id: string, action: "publish" | "unpublish" | "archive") {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/wiki/admin/articles/${id}/${action}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title="Agency Wiki"
          subtitle="Manage shared operating articles. This is not a product, service, or workflow."
        />
        <div className="panel" style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title…"
              style={{ minWidth: 220, flex: 1 }}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <button className="btn ghost" type="button" onClick={() => void load()}>
              Apply
            </button>
            <Link className="btn" href="/admin/wiki/new">
              New article
            </Link>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {categories.length} categories · {articles.length} articles shown
          </p>
          {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
        </div>

        {articles.length === 0 ? (
          <div className="panel">
            <EmptyState title="No wiki articles" description="Create an article or adjust filters." />
          </div>
        ) : (
          <div className="panel" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th align="left">Title</th>
                  <th align="left">Category</th>
                  <th align="left">Status</th>
                  <th align="left">Links</th>
                  <th align="left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/wiki/${a.id}`}>{a.title}</Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        /wiki/{a.category.slug}/{a.slug}
                      </div>
                    </td>
                    <td>{a.category.name}</td>
                    <td>{a.status}</td>
                    <td className="muted">
                      A{a._count.relatedAgencies} · W{a._count.relatedWorkflows} · R
                      {a._count.relatedFrom}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <Link className="btn ghost" href={`/admin/wiki/${a.id}`}>
                          Edit
                        </Link>
                        {a.status !== "PUBLISHED" ? (
                          <button
                            className="btn"
                            type="button"
                            disabled={busyId === a.id}
                            onClick={() => void setArticleStatus(a.id, "publish")}
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={busyId === a.id}
                            onClick={() => void setArticleStatus(a.id, "unpublish")}
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void setArticleStatus(a.id, "archive")}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={pager.page}
              totalPages={pager.totalPages}
              total={pager.total}
              pageSize={pager.pageSize}
              show={pager.showPagination}
              onPageChange={pager.setPage}
            />
          </div>
        )}
      </AdminShell>
    </Protected>
  );
}
