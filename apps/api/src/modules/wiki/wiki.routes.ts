import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAdmin, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { ok } from "../../utils/response";
import { writeAuditLog } from "../audit/audit";
import { rateLimit } from "../../middleware/rateLimit";
import { env } from "../../config/env";
import {
  adminCreateArticle,
  adminListAll,
  adminSetStatus,
  adminUpdateArticle,
  askWiki,
  assertWikiReader,
  findWikiLinksForWorkflow,
  getArticleById,
  getArticleByPath,
  getProgress,
  listArticles,
  listBookmarks,
  listCategories,
  listHistory,
  recordHistory,
  searchWiki,
  setProgress,
  toggleBookmark,
  userArticleFlags,
} from "./wiki.service";

export const wikiRouter = Router();

wikiRouter.use(authenticate);

const contentSchema = z.object({
  whatThisMeans: z.string().optional(),
  whyItMatters: z.string().optional(),
  whenToUse: z.string().optional(),
  steps: z.array(z.string()).optional(),
  example: z.string().optional(),
  commonMistakes: z.array(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
  aiAssistance: z.string().optional(),
  humanReview: z.string().optional(),
  nextAction: z.string().optional(),
});

wikiRouter.get("/categories", async (req: AuthRequest, res, next) => {
  try {
    await assertWikiReader(req.user!.id, req.user!.role);
    const categories = await listCategories(false);
    res.json(ok({ categories }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.get(
  "/articles",
  validate(
    z.object({
      category: z.string().optional(),
      q: z.string().optional(),
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    }),
    "query"
  ),
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      const query = req.query as {
        category?: string;
        q?: string;
        page?: number;
        pageSize?: number;
      };
      const result = await listArticles({
        categorySlug: query.category,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      });
      res.json(ok(result));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.get(
  "/search",
  validate(z.object({ q: z.string().min(1) }), "query"),
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      const q = String((req.query as { q: string }).q);
      const results = await searchWiki(q, 25);
      res.json(ok({ query: q, results }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/ask",
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_AI_MAX,
    name: "wiki-ask",
  }),
  validate(z.object({ question: z.string().min(3).max(500) })),
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      const { question } = req.body as { question: string };
      const answer = await askWiki(question);
      res.json(ok(answer));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.get("/bookmarks", async (req: AuthRequest, res, next) => {
  try {
    await assertWikiReader(req.user!.id, req.user!.role);
    const bookmarks = await listBookmarks(req.user!.id);
    res.json(ok({ bookmarks }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.get("/history", async (req: AuthRequest, res, next) => {
  try {
    await assertWikiReader(req.user!.id, req.user!.role);
    const history = await listHistory(req.user!.id);
    res.json(ok({ history }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.get("/progress", async (req: AuthRequest, res, next) => {
  try {
    await assertWikiReader(req.user!.id, req.user!.role);
    const progress = await getProgress(req.user!.id);
    res.json(ok({ progress }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.get(
  "/workflow-links/:workflowId",
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      const links = await findWikiLinksForWorkflow(req.params.workflowId);
      res.json(
        ok({
          articles: links.map((l) => l.article),
        })
      );
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.get(
  "/articles/:categorySlug/:articleSlug",
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      const article = await getArticleByPath(
        req.params.categorySlug,
        req.params.articleSlug,
        false
      );
      await recordHistory(req.user!.id, article.id);
      const flags = await userArticleFlags(req.user!.id, article.id);
      res.json({
        ...ok({
          article: {
            ...article,
            relatedArticles: article.relatedFrom
              .map((r) => r.relatedArticle)
              .filter((a) => a.status === "PUBLISHED"),
            relatedAgencies: article.relatedAgencies
              .map((r) => r.product)
              .filter((p) => p.status === "PUBLISHED"),
            relatedWorkflows: article.relatedWorkflows.map((r) => r.workflow),
          },
          flags,
        }),
      });
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/articles/:articleId/bookmark",
  validate(z.object({ on: z.boolean() })),
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      await getArticleById(req.params.articleId);
      await toggleBookmark(req.user!.id, req.params.articleId, (req.body as { on: boolean }).on);
      const flags = await userArticleFlags(req.user!.id, req.params.articleId);
      res.json(ok({ flags }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/articles/:articleId/complete",
  validate(z.object({ completed: z.boolean() })),
  async (req: AuthRequest, res, next) => {
    try {
      await assertWikiReader(req.user!.id, req.user!.role);
      await getArticleById(req.params.articleId);
      await setProgress(
        req.user!.id,
        req.params.articleId,
        (req.body as { completed: boolean }).completed
      );
      const [flags, progress] = await Promise.all([
        userArticleFlags(req.user!.id, req.params.articleId),
        getProgress(req.user!.id),
      ]);
      res.json(ok({ flags, progress }));
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

wikiRouter.get("/admin/articles", requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED")
        : undefined;
    const categoryId =
      typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const [articles, categories] = await Promise.all([
      adminListAll({ q, status, categoryId }),
      listCategories(true),
    ]);
    res.json(ok({ articles, categories }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.get("/admin/articles/:id", requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const article = await getArticleById(req.params.id);
    res.json(ok({ article }));
  } catch (err) {
    next(err);
  }
});

wikiRouter.post(
  "/admin/articles",
  requireAdmin,
  validate(
    z.object({
      categoryId: z.string().min(1),
      title: z.string().min(2).max(200),
      slug: z.string().min(2).max(120).optional(),
      summary: z.string().min(10).max(2000),
      content: contentSchema,
      keywords: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      displayOrder: z.number().int().optional(),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      relatedArticleIds: z.array(z.string()).optional(),
      relatedProductIds: z.array(z.string()).optional(),
      relatedWorkflowIds: z.array(z.string()).optional(),
    })
  ),
  async (req: AuthRequest, res, next) => {
    try {
      const article = await adminCreateArticle(req.body);
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "wiki.article.create",
        entityType: "WikiArticle",
        entityId: article.id,
        metadata: { title: article.title, status: article.status },
      });
      res.status(201).json(ok({ article }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.patch(
  "/admin/articles/:id",
  requireAdmin,
  validate(
    z.object({
      categoryId: z.string().optional(),
      title: z.string().min(2).max(200).optional(),
      slug: z.string().min(2).max(120).optional(),
      summary: z.string().min(10).max(2000).optional(),
      content: contentSchema.optional(),
      keywords: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      displayOrder: z.number().int().optional(),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      relatedArticleIds: z.array(z.string()).optional(),
      relatedProductIds: z.array(z.string()).optional(),
      relatedWorkflowIds: z.array(z.string()).optional(),
    })
  ),
  async (req: AuthRequest, res, next) => {
    try {
      const article = await adminUpdateArticle(req.params.id, req.body);
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "wiki.article.update",
        entityType: "WikiArticle",
        entityId: article.id,
        metadata: { title: article.title, status: article.status },
      });
      res.json(ok({ article }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/admin/articles/:id/publish",
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const article = await adminSetStatus(req.params.id, "PUBLISHED");
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "wiki.article.publish",
        entityType: "WikiArticle",
        entityId: article.id,
      });
      res.json(ok({ article }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/admin/articles/:id/unpublish",
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const article = await adminSetStatus(req.params.id, "DRAFT");
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "wiki.article.unpublish",
        entityType: "WikiArticle",
        entityId: article.id,
      });
      res.json(ok({ article }));
    } catch (err) {
      next(err);
    }
  }
);

wikiRouter.post(
  "/admin/articles/:id/archive",
  requireAdmin,
  async (req: AuthRequest, res, next) => {
    try {
      const article = await adminSetStatus(req.params.id, "ARCHIVED");
      await writeAuditLog({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: "wiki.article.archive",
        entityType: "WikiArticle",
        entityId: article.id,
      });
      res.json(ok({ article }));
    } catch (err) {
      next(err);
    }
  }
);
