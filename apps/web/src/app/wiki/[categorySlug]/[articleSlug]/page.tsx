"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Protected } from "@/components/Protected";
import { apiFetch, ApiClientError } from "@/lib/api";
import "@/app/wiki/wiki.css";

type ArticleBody = {
  whatThisMeans?: string;
  whyItMatters?: string;
  whenToUse?: string;
  steps?: string[];
  example?: string;
  commonMistakes?: string[];
  checklist?: string[];
  aiAssistance?: string;
  humanReview?: string;
  nextAction?: string;
};

type ArticlePayload = {
  article: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    keywords: string[];
    tags: string[];
    content: ArticleBody;
    category: { name: string; slug: string };
    relatedArticles: Array<{
      id: string;
      title: string;
      slug: string;
      summary: string;
      category: { name: string; slug: string };
    }>;
    relatedAgencies: Array<{
      id: string;
      name: string;
      slug: string;
      shortDescription: string | null;
    }>;
    relatedWorkflows: Array<{
      id: string;
      name: string;
      key: string;
      description: string | null;
      product: { slug: string; name: string };
    }>;
  };
  flags: { bookmarked: boolean; completed: boolean };
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <section className="wiki-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function WikiArticlePage() {
  const params = useParams<{ categorySlug: string; articleSlug: string }>();
  const [data, setData] = useState<ArticlePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiFetch<ArticlePayload>(
      `/api/wiki/articles/${params.categorySlug}/${params.articleSlug}`
    );
    setData(res);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof ApiClientError ? err.message : "Failed to load article")
    );
  }, [params.categorySlug, params.articleSlug]);

  async function toggleBookmark() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/wiki/articles/${data.article.id}/bookmark`, {
        method: "POST",
        body: JSON.stringify({ on: !data.flags.bookmarked }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch(`/api/wiki/articles/${data.article.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ completed: !data.flags.completed }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const a = data?.article;
  const c = a?.content;

  return (
    <Protected>
      <AppShell>
        <div className="wiki-article-page">
          {error ? (
            <div className="panel">
              <EmptyState title="Article unavailable" description={error} />
              <Link className="btn ghost" href="/wiki">
                Back to Wiki
              </Link>
            </div>
          ) : !a ? (
            <div className="panel muted">Loading article…</div>
          ) : (
            <>
              <nav className="wiki-breadcrumb">
                <Link href="/wiki">Agency Wiki</Link>
                <span>/</span>
                <Link href={`/wiki?category=${a.category.slug}`}>{a.category.name}</Link>
                <span>/</span>
                <span>{a.title}</span>
              </nav>

              <header className="wiki-article-head panel">
                <span className="wiki-cat-pill">{a.category.name}</span>
                <h1>{a.title}</h1>
                <p className="wiki-summary">{a.summary}</p>
                <div className="wiki-article-actions">
                  <button className="btn" type="button" disabled={busy} onClick={() => void toggleComplete()}>
                    {data?.flags.completed ? "Completed ✓" : "Mark as Complete"}
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleBookmark()}
                  >
                    {data?.flags.bookmarked ? "Bookmarked" : "Bookmark"}
                  </button>
                  <Link className="btn ghost" href="/wiki">
                    Back to Wiki
                  </Link>
                </div>
              </header>

              <article className="wiki-article-body panel">
                <Section title="What this means">
                  <p>{c?.whatThisMeans}</p>
                </Section>
                <Section title="Why it matters">
                  <p>{c?.whyItMatters}</p>
                </Section>
                <Section title="When to use it">
                  <p>{c?.whenToUse}</p>
                </Section>
                <Section title="Step-by-step process">
                  <ol>
                    {(c?.steps ?? []).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </Section>
                <Section title="Practical example">
                  <p>{c?.example}</p>
                </Section>
                <Section title="Common mistakes">
                  <ul>
                    {(c?.commonMistakes ?? []).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Quality checklist">
                  <ul className="wiki-checklist">
                    {(c?.checklist ?? []).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="AI assistance">
                  <p>{c?.aiAssistance}</p>
                </Section>
                <Section title="Human review">
                  <p className="wiki-human-review">{c?.humanReview}</p>
                </Section>
                <Section title="Next action">
                  <p>{c?.nextAction}</p>
                </Section>
              </article>

              <div className="wiki-related-grid">
                <div className="panel">
                  <h3>Related Wiki articles</h3>
                  {a.relatedArticles.length === 0 ? (
                    <p className="muted">No related articles linked yet.</p>
                  ) : (
                    <ul>
                      {a.relatedArticles.map((r) => (
                        <li key={r.id}>
                          <Link href={`/wiki/${r.category.slug}/${r.slug}`}>{r.title}</Link>
                          <div className="muted">{r.summary}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel">
                  <h3>Related agencies</h3>
                  {a.relatedAgencies.length === 0 ? (
                    <p className="muted">Universal operating topic — applies across agencies.</p>
                  ) : (
                    <ul>
                      {a.relatedAgencies.map((p) => (
                        <li key={p.id}>
                          <Link href={`/products/${p.slug}`}>Open Related Agency → {p.name}</Link>
                          {p.shortDescription ? (
                            <div className="muted">{p.shortDescription}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel">
                  <h3>Related workflows</h3>
                  {a.relatedWorkflows.length === 0 ? (
                    <p className="muted">No workflow links for this article.</p>
                  ) : (
                    <ul>
                      {a.relatedWorkflows.map((w) => (
                        <li key={w.id}>
                          <Link href={`/products/${w.product.slug}/workflows/${w.id}`}>
                            Open Related Workflow → {w.name}
                          </Link>
                          <div className="muted">{w.product.name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </Protected>
  );
}
