import { prisma, type WikiStatus, type Prisma } from "@aes/database";
import { AppError, assertFound } from "../../utils/errors";
import { getAiProvider } from "../ai/provider";

export type WikiArticleContent = {
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

const articleListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  keywords: true,
  tags: true,
  displayOrder: true,
  status: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, slug: true, displayOrder: true },
  },
} satisfies Prisma.WikiArticleSelect;

const wikiAccessMemo = new Map<string, { at: number; ok: boolean }>();
const WIKI_ACCESS_MEMO_MS = 60_000;

async function userMayReadWiki(userId: string, role: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  const hit = wikiAccessMemo.get(userId);
  if (hit && Date.now() - hit.at < WIKI_ACCESS_MEMO_MS) return hit.ok;

  const access = await prisma.productAccess.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      product: { status: "PUBLISHED" },
    },
    select: { id: true },
  });
  const ok = Boolean(access);
  wikiAccessMemo.set(userId, { at: Date.now(), ok });
  if (wikiAccessMemo.size > 500) {
    const oldest = wikiAccessMemo.keys().next().value;
    if (oldest) wikiAccessMemo.delete(oldest);
  }
  return ok;
}

export async function assertWikiReader(userId: string, role: string) {
  const ok = await userMayReadWiki(userId, role);
  if (!ok) {
    throw new AppError(
      403,
      "Agency Wiki requires access to at least one product",
      "FORBIDDEN"
    );
  }
}

function scoreArticle(
  q: string,
  article: {
    title: string;
    summary: string;
    keywords: string[];
    tags: string[];
    category: { name: string; slug: string };
    content: unknown;
  }
): number {
  const terms = q
    .toLowerCase()
    .split(/[\s?!,.;:]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  if (!terms.length) return 0;

  const body = typeof article.content === "object" && article.content
    ? JSON.stringify(article.content).toLowerCase()
    : "";
  const hay = {
    title: article.title.toLowerCase(),
    summary: article.summary.toLowerCase(),
    keywords: article.keywords.map((k) => k.toLowerCase()).join(" "),
    tags: article.tags.map((t) => t.toLowerCase()).join(" "),
    category: `${article.category.name} ${article.category.slug}`.toLowerCase(),
    body,
  };

  let score = 0;
  for (const term of terms) {
    if (hay.title.includes(term)) score += 12;
    if (hay.title.split(/\s+/).some((w) => w.startsWith(term))) score += 6;
    if (hay.summary.includes(term)) score += 6;
    if (hay.keywords.includes(term)) score += 8;
    if (hay.tags.includes(term)) score += 5;
    if (hay.category.includes(term)) score += 4;
    if (hay.body.includes(term)) score += 2;
  }
  // Phrase bonus
  const phrase = q.toLowerCase().trim();
  if (phrase.length > 4) {
    if (hay.title.includes(phrase)) score += 20;
    if (hay.summary.includes(phrase)) score += 10;
  }
  return score;
}

export async function listCategories(includeDrafts = false) {
  return prisma.wikiCategory.findMany({
    where: includeDrafts ? undefined : { status: "PUBLISHED" },
    orderBy: { displayOrder: "asc" },
    include: {
      _count: {
        select: {
          articles: {
            where: includeDrafts ? undefined : { status: "PUBLISHED" },
          },
        },
      },
    },
  });
}

export async function listArticles(opts: {
  categorySlug?: string;
  includeDrafts?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 40));
  const where: Prisma.WikiArticleWhereInput = {
    status: opts.includeDrafts ? undefined : "PUBLISHED",
    ...(opts.categorySlug
      ? { category: { slug: opts.categorySlug } }
      : {}),
  };

  if (opts.q?.trim()) {
    const all = await prisma.wikiArticle.findMany({
      where: { ...where, status: opts.includeDrafts ? undefined : "PUBLISHED" },
      select: {
        ...articleListSelect,
        content: true,
      },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    });
    const ranked = all
      .map((a) => ({ article: a, score: scoreArticle(opts.q!, a) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));

    const total = ranked.length;
    const slice = ranked.slice((page - 1) * pageSize, page * pageSize).map((r) => {
      const { content: _c, ...rest } = r.article;
      return { ...rest, score: r.score };
    });
    return { articles: slice, total, page, pageSize };
  }

  const [total, articles] = await Promise.all([
    prisma.wikiArticle.count({ where }),
    prisma.wikiArticle.findMany({
      where,
      select: articleListSelect,
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { articles, total, page, pageSize };
}

export async function getArticleByPath(categorySlug: string, articleSlug: string, includeDrafts = false) {
  const article = await prisma.wikiArticle.findFirst({
    where: {
      slug: articleSlug,
      ...(includeDrafts
        ? { category: { slug: categorySlug } }
        : {
            status: "PUBLISHED",
            category: { slug: categorySlug, status: "PUBLISHED" },
          }),
    },
    include: {
      category: true,
      relatedAgencies: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
              icon: true,
              status: true,
            },
          },
        },
      },
      relatedWorkflows: {
        include: {
          workflow: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              product: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      relatedFrom: {
        include: {
          relatedArticle: {
            select: {
              id: true,
              title: true,
              slug: true,
              summary: true,
              status: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });
  assertFound(article, "Wiki article not found");
  if (!includeDrafts && article.status !== "PUBLISHED") {
    throw new AppError(404, "Wiki article not found", "NOT_FOUND");
  }
  return article;
}

export async function getArticleById(id: string) {
  const article = await prisma.wikiArticle.findUnique({
    where: { id },
    include: {
      category: true,
      relatedAgencies: { include: { product: { select: { id: true, name: true, slug: true } } } },
      relatedWorkflows: {
        include: {
          workflow: {
            select: {
              id: true,
              key: true,
              name: true,
              product: { select: { id: true, slug: true, name: true } },
            },
          },
        },
      },
      relatedFrom: {
        include: {
          relatedArticle: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });
  assertFound(article, "Wiki article not found");
  return article;
}

export async function searchWiki(q: string, limit = 20) {
  const { articles } = await listArticles({ q, page: 1, pageSize: limit });
  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    summary: a.summary,
    keywords: a.keywords,
    category: a.category,
    score: "score" in a ? (a as { score?: number }).score : undefined,
  }));
}

export async function askWiki(question: string) {
  const results = await searchWiki(question, 8);
  const recommendedReading = results.slice(0, 5).map((a) => ({
    title: a.title,
    path: `/wiki/${a.category.slug}/${a.slug}`,
    summary: a.summary,
    category: a.category.name,
  }));

  const base = {
    question,
    articles: results,
    recommendedReading,
    sources: recommendedReading,
  };

  const provider = getAiProvider();
  if (!provider || results.length === 0) {
    return {
      ...base,
      mode: "search-retrieval" as const,
      note:
        results.length === 0
          ? "I couldn't find enough information in the Agency Wiki to answer this confidently."
          : "Ask Agency Wiki returned retrieval-based reading recommendations from published Wiki articles. Native AI synthesis is not enabled — answers are not invented.",
      answer:
        results.length === 0
          ? "I couldn't find enough information in the Agency Wiki to answer this confidently."
          : null,
    };
  }

  // Load full bodies for top articles (published only)
  const topIds = results.slice(0, 5).map((a) => a.id);
  const full = await prisma.wikiArticle.findMany({
    where: { id: { in: topIds }, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      content: true,
      category: { select: { name: true, slug: true } },
    },
  });

  if (!full.length) {
    return {
      ...base,
      mode: "search-retrieval" as const,
      note: "I couldn't find enough information in the Agency Wiki to answer this confidently.",
      answer: "I couldn't find enough information in the Agency Wiki to answer this confidently.",
    };
  }

  const contextBlocks = full.map((a, i) => {
    const body = typeof a.content === "object" && a.content ? JSON.stringify(a.content) : "";
    return `[Source ${i + 1}] ${a.title} (${a.category.name})\nSummary: ${a.summary}\n${body.slice(0, 3500)}`;
  });

  const system = `You are the Agency Wiki assistant for AI Enterprise Studio.
Answer ONLY using the provided Wiki source excerpts.
If the sources are insufficient, say exactly: I couldn't find enough information in the Agency Wiki to answer this confidently.
Do not invent policies, prices, legal claims, or guaranteed outcomes.
Keep answers practical and concise.
Cite sources by title in the answer when relevant.`;

  try {
    const generated = await provider.generate({
      system,
      prompt: `Question: ${question}\n\nWiki sources:\n${contextBlocks.join("\n\n")}`,
      maxTokens: 900,
    });

    const insufficient = generated.text
      .toLowerCase()
      .includes("couldn't find enough information");

    return {
      ...base,
      mode: insufficient ? ("insufficient-context" as const) : ("grounded-answer" as const),
      note: "Answer grounded in published Agency Wiki articles only.",
      answer: generated.text,
      model: generated.model,
      provider: generated.provider,
    };
  } catch {
    return {
      ...base,
      mode: "search-retrieval" as const,
      note: "AI provider unavailable — showing Wiki article recommendations only.",
      answer: null,
    };
  }
}

export async function recordHistory(userId: string, articleId: string) {
  await prisma.userWikiHistory.upsert({
    where: { userId_articleId: { userId, articleId } },
    create: { userId, articleId, viewedAt: new Date() },
    update: { viewedAt: new Date() },
  });
  // Cap history at 30 per user
  const extras = await prisma.userWikiHistory.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    skip: 30,
    select: { id: true },
  });
  if (extras.length) {
    await prisma.userWikiHistory.deleteMany({
      where: { id: { in: extras.map((e) => e.id) } },
    });
  }
}

export async function listHistory(userId: string, limit = 12) {
  return prisma.userWikiHistory.findMany({
    where: { userId, article: { status: "PUBLISHED" } },
    orderBy: { viewedAt: "desc" },
    take: limit,
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

export async function listBookmarks(userId: string) {
  return prisma.userWikiBookmark.findMany({
    where: { userId, article: { status: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

export async function toggleBookmark(userId: string, articleId: string, on: boolean) {
  if (on) {
    await prisma.userWikiBookmark.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId },
      update: {},
    });
  } else {
    await prisma.userWikiBookmark.deleteMany({ where: { userId, articleId } });
  }
}

export async function setProgress(userId: string, articleId: string, completed: boolean) {
  if (completed) {
    await prisma.userWikiProgress.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId },
      update: { completedAt: new Date() },
    });
  } else {
    await prisma.userWikiProgress.deleteMany({ where: { userId, articleId } });
  }
}

export async function getProgress(userId: string) {
  const [categories, completed] = await Promise.all([
    prisma.wikiCategory.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { displayOrder: "asc" },
      include: {
        articles: {
          where: { status: "PUBLISHED" },
          select: { id: true },
        },
      },
    }),
    prisma.userWikiProgress.findMany({
      where: { userId, article: { status: "PUBLISHED" } },
      select: { articleId: true },
    }),
  ]);
  const done = new Set(completed.map((c) => c.articleId));
  let total = 0;
  let doneTotal = 0;
  const byCategory = categories.map((c) => {
    const catTotal = c.articles.length;
    const catDone = c.articles.filter((a) => done.has(a.id)).length;
    total += catTotal;
    doneTotal += catDone;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      completed: catDone,
      total: catTotal,
    };
  });
  return {
    overall: { completed: doneTotal, total },
    categories: byCategory,
    completedArticleIds: [...done],
  };
}

export async function userArticleFlags(userId: string, articleId: string) {
  const [bookmark, progress] = await Promise.all([
    prisma.userWikiBookmark.findUnique({
      where: { userId_articleId: { userId, articleId } },
    }),
    prisma.userWikiProgress.findUnique({
      where: { userId_articleId: { userId, articleId } },
    }),
  ]);
  return {
    bookmarked: Boolean(bookmark),
    completed: Boolean(progress),
    completedAt: progress?.completedAt ?? null,
  };
}

export async function findWikiLinksForWorkflow(workflowId: string) {
  return prisma.wikiArticleWorkflow.findMany({
    where: {
      workflowId,
      article: { status: "PUBLISHED" },
    },
    take: 5,
    include: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/→/g, "to")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function adminCreateArticle(data: {
  categoryId: string;
  title: string;
  slug?: string;
  summary: string;
  content: WikiArticleContent;
  keywords?: string[];
  tags?: string[];
  displayOrder?: number;
  status?: WikiStatus;
  relatedArticleIds?: string[];
  relatedProductIds?: string[];
  relatedWorkflowIds?: string[];
}) {
  const slug = data.slug?.trim() || slugify(data.title);
  const article = await prisma.wikiArticle.create({
    data: {
      categoryId: data.categoryId,
      title: data.title.trim(),
      slug,
      summary: data.summary.trim(),
      content: data.content as Prisma.InputJsonValue,
      keywords: data.keywords ?? [],
      tags: data.tags ?? [],
      displayOrder: data.displayOrder ?? 0,
      status: data.status ?? "DRAFT",
    },
  });
  await syncRelations(article.id, data);
  return getArticleById(article.id);
}

export async function adminUpdateArticle(
  id: string,
  data: Partial<{
    categoryId: string;
    title: string;
    slug: string;
    summary: string;
    content: WikiArticleContent;
    keywords: string[];
    tags: string[];
    displayOrder: number;
    status: WikiStatus;
    relatedArticleIds: string[];
    relatedProductIds: string[];
    relatedWorkflowIds: string[];
  }>
) {
  await getArticleById(id);
  await prisma.wikiArticle.update({
    where: { id },
    data: {
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(data.title ? { title: data.title.trim() } : {}),
      ...(data.slug ? { slug: data.slug.trim() } : {}),
      ...(data.summary != null ? { summary: data.summary.trim() } : {}),
      ...(data.content ? { content: data.content as Prisma.InputJsonValue } : {}),
      ...(data.keywords ? { keywords: data.keywords } : {}),
      ...(data.tags ? { tags: data.tags } : {}),
      ...(data.displayOrder != null ? { displayOrder: data.displayOrder } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
  });
  if (
    data.relatedArticleIds ||
    data.relatedProductIds ||
    data.relatedWorkflowIds
  ) {
    await syncRelations(id, data);
  }
  return getArticleById(id);
}

async function syncRelations(
  articleId: string,
  data: {
    relatedArticleIds?: string[];
    relatedProductIds?: string[];
    relatedWorkflowIds?: string[];
  }
) {
  if (data.relatedArticleIds) {
    await prisma.wikiArticleRelatedArticle.deleteMany({ where: { articleId } });
    const ids = data.relatedArticleIds.filter((x) => x !== articleId);
    if (ids.length) {
      await prisma.wikiArticleRelatedArticle.createMany({
        data: ids.map((relatedArticleId) => ({ articleId, relatedArticleId })),
        skipDuplicates: true,
      });
    }
  }
  if (data.relatedProductIds) {
    await prisma.wikiArticleAgency.deleteMany({ where: { articleId } });
    if (data.relatedProductIds.length) {
      await prisma.wikiArticleAgency.createMany({
        data: data.relatedProductIds.map((productId) => ({ articleId, productId })),
        skipDuplicates: true,
      });
    }
  }
  if (data.relatedWorkflowIds) {
    await prisma.wikiArticleWorkflow.deleteMany({ where: { articleId } });
    if (data.relatedWorkflowIds.length) {
      await prisma.wikiArticleWorkflow.createMany({
        data: data.relatedWorkflowIds.map((workflowId) => ({ articleId, workflowId })),
        skipDuplicates: true,
      });
    }
  }
}

export async function adminSetStatus(id: string, status: WikiStatus) {
  await getArticleById(id);
  return prisma.wikiArticle.update({
    where: { id },
    data: { status },
    include: { category: true },
  });
}

export async function adminListAll(opts?: { q?: string; status?: WikiStatus; categoryId?: string }) {
  // No per-row _count — 172 articles × 3 count joins is very slow over Supabase.
  return prisma.wikiArticle.findMany({
    where: {
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts?.q
        ? {
            OR: [
              { title: { contains: opts.q, mode: "insensitive" } },
              { summary: { contains: opts.q, mode: "insensitive" } },
              { slug: { contains: opts.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: { displayOrder: "asc" } }, { displayOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      displayOrder: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}
