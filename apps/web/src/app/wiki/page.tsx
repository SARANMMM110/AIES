"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { apiFetch, ApiClientError } from "@/lib/api";
import "@/app/wiki/wiki.css";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  _count: { articles: number };
};

type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  keywords: string[];
  category: { name: string; slug: string };
  score?: number;
};

type Progress = {
  overall: { completed: number; total: number };
  categories: Array<{ name: string; slug: string; completed: number; total: number }>;
};

type HistoryRow = {
  viewedAt: string;
  article: ArticleCard;
};

type AskResult = {
  mode: string;
  note: string;
  answer?: string | null;
  recommendedReading: Array<{
    title: string;
    path: string;
    summary: string;
    category: string;
  }>;
  sources?: Array<{
    title: string;
    path: string;
    summary: string;
    category: string;
  }>;
};

export default function WikiHomePage() {
  return (
    <Suspense fallback={<div className="panel muted">Loading wiki…</div>}>
      <WikiHomeInner />
    </Suspense>
  );
}

function WikiHomeInner() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [bookmarks, setBookmarks] = useState<Array<{ article: ArticleCard }>>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>(searchParams.get("category") || "");
  const [askQ, setAskQ] = useState("");
  const [ask, setAsk] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  async function loadBase() {
    const [cats, prog, hist, marks] = await Promise.all([
      apiFetch<{ categories: Category[] }>("/api/wiki/categories"),
      apiFetch<{ progress: Progress }>("/api/wiki/progress"),
      apiFetch<{ history: HistoryRow[] }>("/api/wiki/history"),
      apiFetch<{ bookmarks: Array<{ article: ArticleCard }> }>("/api/wiki/bookmarks"),
    ]);
    setCategories(cats.categories);
    setProgress(prog.progress);
    setHistory(hist.history);
    setBookmarks(marks.bookmarks);
  }

  async function loadArticles(category?: string, query?: string) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query) params.set("q", query);
    params.set("pageSize", "60");
    const data = await apiFetch<{ articles: ArticleCard[] }>(`/api/wiki/articles?${params}`);
    setArticles(data.articles);
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadBase();
        await loadArticles(activeCat || undefined);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load Agency Wiki");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      await loadArticles(activeCat || undefined, q.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function selectCategory(slug: string) {
    const next = activeCat === slug ? "" : slug;
    setActiveCat(next);
    setSearching(true);
    try {
      await loadArticles(next || undefined, q.trim() || undefined);
    } finally {
      setSearching(false);
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (askQ.trim().length < 3) return;
    try {
      const data = await apiFetch<AskResult>("/api/wiki/ask", {
        method: "POST",
        body: JSON.stringify({ question: askQ.trim() }),
      });
      setAsk(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Ask Wiki failed");
    }
  }

  const overallLabel = useMemo(() => {
    if (!progress) return null;
    return `${progress.overall.completed} / ${progress.overall.total} complete`;
  }, [progress]);

  return (
    <Protected>
      <AppShell>
        <div className="wiki-home">
          <PageHeader
            title="Agency Wiki"
            subtitle="Shared operating knowledge for every agency product — position, sell, deliver, operate, and grow with control."
          />

          <form className="wiki-search" onSubmit={onSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Search the Wiki… e.g. "How do I price my first service?"'
              aria-label="Search the Wiki"
            />
            <button className="btn" type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="wiki-ask panel">
            <h3>Ask Agency Wiki</h3>
            <p className="muted">
              Retrieval from published Wiki articles only. Native AI synthesis is not enabled yet —
              no invented answers.
            </p>
            <form onSubmit={onAsk} className="wiki-ask-form">
              <input
                value={askQ}
                onChange={(e) => setAskQ(e.target.value)}
                placeholder="What should I prepare before my first discovery call?"
              />
              <button className="btn ghost" type="submit">
                Ask
              </button>
            </form>
            {ask ? (
              <div className="wiki-ask-results">
                <p className="muted">{ask.note}</p>
                {ask.answer ? (
                  <div className="panel" style={{ marginTop: 8 }}>
                    <strong>Answer</strong>
                    <p style={{ whiteSpace: "pre-wrap" }}>{ask.answer}</p>
                  </div>
                ) : null}
                <h4 style={{ marginBottom: 4 }}>Sources</h4>
                <ul>
                  {(ask.sources ?? ask.recommendedReading).map((r) => (
                    <li key={r.path}>
                      <Link href={r.path}>
                        <strong>{r.title}</strong>
                      </Link>
                      <span className="muted"> — {r.category}</span>
                      <div className="muted">{r.summary}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="panel">
              <EmptyState title="Wiki unavailable" description={error} />
            </div>
          ) : null}

          <div className="wiki-layout">
            <aside className="wiki-nav panel">
              <h3>Categories</h3>
              <button
                type="button"
                className={!activeCat ? "wiki-nav-item active" : "wiki-nav-item"}
                onClick={() => void selectCategory("")}
              >
                All articles
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={activeCat === c.slug ? "wiki-nav-item active" : "wiki-nav-item"}
                  onClick={() => void selectCategory(c.slug)}
                >
                  <span>{c.name}</span>
                  <span className="muted">{c._count.articles}</span>
                </button>
              ))}

              {progress ? (
                <div className="wiki-progress-box">
                  <h4>Progress</h4>
                  <p>
                    Agency Wiki
                    <br />
                    <strong>{overallLabel}</strong>
                  </p>
                  <ul>
                    {progress.categories.map((c) => (
                      <li key={c.slug}>
                        {c.name}: {c.completed} / {c.total}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bookmarks.length ? (
                <div className="wiki-side-list">
                  <h4>My Saved Wiki Articles</h4>
                  <ul>
                    {bookmarks.slice(0, 8).map((b) => (
                      <li key={b.article.id}>
                        <Link href={`/wiki/${b.article.category.slug}/${b.article.slug}`}>
                          {b.article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {history.length ? (
                <div className="wiki-side-list">
                  <h4>Recently Viewed</h4>
                  <ul>
                    {history.slice(0, 8).map((h) => (
                      <li key={h.article.id}>
                        <Link href={`/wiki/${h.article.category.slug}/${h.article.slug}`}>
                          {h.article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </aside>

            <main className="wiki-main">
              {loading ? (
                <div className="panel muted">Loading wiki…</div>
              ) : articles.length === 0 ? (
                <div className="panel">
                  <EmptyState
                    title="No articles matched"
                    description="Try a shorter query or clear the category filter."
                  />
                </div>
              ) : (
                <div className="wiki-article-grid">
                  {articles.map((a) => (
                    <Link
                      key={a.id}
                      href={`/wiki/${a.category.slug}/${a.slug}`}
                      className="wiki-article-card"
                    >
                      <span className="wiki-cat-pill">{a.category.name}</span>
                      <h3>{a.title}</h3>
                      <p>{a.summary}</p>
                      {a.keywords?.length ? (
                        <div className="wiki-keywords">
                          {a.keywords.slice(0, 4).map((k) => (
                            <span key={k}>{k}</span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </AppShell>
    </Protected>
  );
}
