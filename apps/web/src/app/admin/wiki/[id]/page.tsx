"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { Protected } from "@/components/Protected";
import { flashToast } from "@/components/Toast";
import { apiFetch, ApiClientError } from "@/lib/api";

type Category = { id: string; name: string; slug: string };
type Product = { id: string; name: string; slug: string };
type WorkflowOpt = { id: string; name: string; product: { slug: string; name: string } };

type Content = {
  whatThisMeans: string;
  whyItMatters: string;
  whenToUse: string;
  steps: string;
  example: string;
  commonMistakes: string;
  checklist: string;
  aiAssistance: string;
  humanReview: string;
  nextAction: string;
};

const emptyContent: Content = {
  whatThisMeans: "",
  whyItMatters: "",
  whenToUse: "",
  steps: "",
  example: "",
  commonMistakes: "",
  checklist: "",
  aiAssistance: "",
  humanReview: "",
  nextAction: "",
};

function lines(s: string) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AdminWikiEditorPage() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowOpt[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tags, setTags] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [content, setContent] = useState<Content>(emptyContent);
  const [relatedProductIds, setRelatedProductIds] = useState<string[]>([]);
  const [relatedWorkflowIds, setRelatedWorkflowIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const admin = await apiFetch<{ categories: Category[] }>("/api/wiki/admin/articles");
        setCategories(admin.categories);
        if (admin.categories[0] && isNew) setCategoryId(admin.categories[0].id);

        const prods = await apiFetch<{ products: Product[] }>("/api/products");
        setProducts(prods.products ?? []);

        if (!isNew) {
          const data = await apiFetch<{
            article: {
              categoryId: string;
              title: string;
              slug: string;
              summary: string;
              keywords: string[];
              tags: string[];
              displayOrder: number;
              status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
              content: Record<string, unknown>;
              relatedAgencies: Array<{ product: { id: string } }>;
              relatedWorkflows: Array<{ workflow: { id: string } }>;
            };
          }>(`/api/wiki/admin/articles/${params.id}`);
          const a = data.article;
          setCategoryId(a.categoryId);
          setTitle(a.title);
          setSlug(a.slug);
          setSummary(a.summary);
          setKeywords((a.keywords ?? []).join(", "));
          setTags((a.tags ?? []).join(", "));
          setDisplayOrder(a.displayOrder);
          setStatus(a.status);
          const c = a.content || {};
          setContent({
            whatThisMeans: String(c.whatThisMeans ?? ""),
            whyItMatters: String(c.whyItMatters ?? ""),
            whenToUse: String(c.whenToUse ?? ""),
            steps: Array.isArray(c.steps) ? c.steps.join("\n") : "",
            example: String(c.example ?? ""),
            commonMistakes: Array.isArray(c.commonMistakes) ? c.commonMistakes.join("\n") : "",
            checklist: Array.isArray(c.checklist) ? c.checklist.join("\n") : "",
            aiAssistance: String(c.aiAssistance ?? ""),
            humanReview: String(c.humanReview ?? ""),
            nextAction: String(c.nextAction ?? ""),
          });
          setRelatedProductIds(a.relatedAgencies.map((x) => x.product.id));
          setRelatedWorkflowIds(a.relatedWorkflows.map((x) => x.workflow.id));
        }
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load editor");
      }
    })();
  }, [isNew, params.id]);

  useEffect(() => {
    if (!relatedProductIds.length) {
      setWorkflows([]);
      return;
    }
    void (async () => {
      try {
        // Load workflows for first related product as convenience picker
        const slug = products.find((p) => p.id === relatedProductIds[0])?.slug;
        if (!slug) return;
        const data = await apiFetch<{
          workflows: Array<{
            id: string;
            name: string;
            product?: { slug: string; name: string };
          }>;
        }>(`/api/products/${encodeURIComponent(slug)}/workflows`);
        setWorkflows(
          (data.workflows ?? []).map((w) => ({
            id: w.id,
            name: w.name,
            product: w.product ?? { slug, name: slug },
          }))
        );
      } catch {
        /* optional */
      }
    })();
  }, [relatedProductIds, products]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const payload = {
      categoryId,
      title,
      slug: slug || undefined,
      summary,
      keywords: keywords
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      tags: tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      displayOrder,
      status,
      content: {
        whatThisMeans: content.whatThisMeans,
        whyItMatters: content.whyItMatters,
        whenToUse: content.whenToUse,
        steps: lines(content.steps),
        example: content.example,
        commonMistakes: lines(content.commonMistakes),
        checklist: lines(content.checklist),
        aiAssistance: content.aiAssistance,
        humanReview: content.humanReview,
        nextAction: content.nextAction,
      },
      relatedProductIds,
      relatedWorkflowIds,
    };
    try {
      if (isNew) {
        const data = await apiFetch<{ article: { id: string } }>("/api/wiki/admin/articles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMsg("Draft created");
        flashToast("Wiki article created.", "success");
        router.replace(`/admin/wiki/${data.article.id}`);
      } else {
        await apiFetch(`/api/wiki/admin/articles/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMsg("Saved");
        flashToast("Wiki article saved.", "success");
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Save failed";
      setError(message);
      flashToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  const cat = categories.find((c) => c.id === categoryId);

  return (
    <Protected adminOnly>
      <AdminShell>
        <PageHeader
          title={isNew ? "New Wiki article" : "Edit Wiki article"}
          subtitle="Publish only after human review of content quality."
        />
        <form className="panel stack-lg" onSubmit={onSubmit}>
          {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
          {msg ? <p className="muted">{msg}</p> : null}

          <div className="form-grid">
            <label>
              Category
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label>
              Title
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from title" />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Summary
              <textarea required rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </label>
            <label>
              Keywords (comma)
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </label>
            <label>
              Tags (comma)
              <input value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
            <label>
              Display order
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
              />
            </label>
          </div>

          {(
            [
              ["whatThisMeans", "What this means"],
              ["whyItMatters", "Why it matters"],
              ["whenToUse", "When to use"],
              ["steps", "Steps (one per line)"],
              ["example", "Practical example"],
              ["commonMistakes", "Common mistakes (one per line)"],
              ["checklist", "Checklist (one per line)"],
              ["aiAssistance", "AI assistance"],
              ["humanReview", "Human review"],
              ["nextAction", "Next action"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                rows={key === "steps" || key === "checklist" || key === "commonMistakes" ? 5 : 3}
                value={content[key]}
                onChange={(e) => setContent((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}

          <fieldset>
            <legend>Related agencies</legend>
            <div style={{ display: "grid", gap: 6 }}>
              {products.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={relatedProductIds.includes(p.id)}
                    onChange={(e) => {
                      setRelatedProductIds((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                      );
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>

          {workflows.length ? (
            <fieldset>
              <legend>Related workflows (from first selected agency)</legend>
              <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
                {workflows.map((w) => (
                  <label key={w.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={relatedWorkflowIds.includes(w.id)}
                      onChange={(e) => {
                        setRelatedWorkflowIds((prev) =>
                          e.target.checked ? [...prev, w.id] : prev.filter((x) => x !== w.id)
                        );
                      }}
                    />
                    {w.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Saving…" : isNew ? "Create draft" : "Save"}
            </button>
            <Link className="btn ghost" href="/admin/wiki">
              Back to list
            </Link>
            {!isNew && cat ? (
              <Link
                className="btn ghost"
                href={`/wiki/${cat.slug}/${slug}`}
                target="_blank"
              >
                Preview
              </Link>
            ) : null}
          </div>
        </form>
      </AdminShell>
    </Protected>
  );
}
