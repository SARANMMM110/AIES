import type { PrismaClient } from "@prisma/client";
import { WIKI_CATEGORIES, wikiArticleCount } from "./content/wiki-catalog";

/**
 * Seed / refresh Agency Wiki categories + articles.
 * Does not create products, services, or workflows.
 */
export async function seedAgencyWiki(prisma: PrismaClient) {
  console.log("  Wiki: loading products + workflows…");
  const products = await prisma.product.findMany({
    select: { id: true, slug: true },
  });
  const productBySlug = new Map(products.map((p) => [p.slug, p.id]));

  const workflows = await prisma.workflowDefinition.findMany({
    select: {
      id: true,
      name: true,
      key: true,
      product: { select: { slug: true } },
    },
  });
  console.log(`  Wiki: ${WIKI_CATEGORIES.length} categories, ${wikiArticleCount()} articles to upsert`);

  const articleIdBySlug = new Map<string, string>();
  const pendingRelations: Array<{
    articleSlug: string;
    relatedArticleSlugs?: string[];
    relatedAgencySlugs?: string[];
    relatedWorkflowHints?: Array<{ productSlug: string; nameIncludes: string }>;
  }> = [];

  let articleIndex = 0;
  for (const cat of WIKI_CATEGORIES) {
    console.log(`  Wiki category: ${cat.slug} (${cat.articles.length} articles)`);
    const category = await prisma.wikiCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        status: "PUBLISHED",
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        displayOrder: cat.displayOrder,
        status: "PUBLISHED",
      },
    });

    for (const art of cat.articles) {
      articleIndex += 1;
      const existing = await prisma.wikiArticle.findUnique({
        where: {
          categoryId_slug: { categoryId: category.id, slug: art.slug },
        },
      });

      const saved = existing
        ? await prisma.wikiArticle.update({
            where: { id: existing.id },
            data: {
              title: art.title,
              summary: art.summary,
              content: art.content,
              keywords: art.keywords,
              tags: art.tags,
              displayOrder: art.displayOrder,
              status: "PUBLISHED",
            },
          })
        : await prisma.wikiArticle.create({
            data: {
              categoryId: category.id,
              slug: art.slug,
              title: art.title,
              summary: art.summary,
              content: art.content,
              keywords: art.keywords,
              tags: art.tags,
              displayOrder: art.displayOrder,
              status: "PUBLISHED",
            },
          });

      articleIdBySlug.set(art.slug, saved.id);
      pendingRelations.push({
        articleSlug: art.slug,
        relatedArticleSlugs: art.relatedArticleSlugs,
        relatedAgencySlugs: art.relatedAgencySlugs,
        relatedWorkflowHints: art.relatedWorkflowHints,
      });

      if (articleIndex % 25 === 0 || articleIndex === wikiArticleCount()) {
        console.log(`  Wiki articles upserted: ${articleIndex}/${wikiArticleCount()}`);
      }
    }
  }

  console.log(`  Wiki: linking relations for ${pendingRelations.length} articles…`);
  let relIndex = 0;
  for (const rel of pendingRelations) {
    relIndex += 1;
    const articleId = articleIdBySlug.get(rel.articleSlug);
    if (!articleId) continue;

    await prisma.wikiArticleRelatedArticle.deleteMany({ where: { articleId } });
    await prisma.wikiArticleAgency.deleteMany({ where: { articleId } });
    await prisma.wikiArticleWorkflow.deleteMany({ where: { articleId } });

    const relatedIds = (rel.relatedArticleSlugs ?? [])
      .map((s) => articleIdBySlug.get(s))
      .filter((id): id is string => Boolean(id) && id !== articleId);
    if (relatedIds.length) {
      await prisma.wikiArticleRelatedArticle.createMany({
        data: relatedIds.map((relatedArticleId) => ({ articleId, relatedArticleId })),
        skipDuplicates: true,
      });
    }

    const productIds = (rel.relatedAgencySlugs ?? [])
      .map((s) => productBySlug.get(s))
      .filter((id): id is string => Boolean(id));
    if (productIds.length) {
      await prisma.wikiArticleAgency.createMany({
        data: productIds.map((productId) => ({ articleId, productId })),
        skipDuplicates: true,
      });
    }

    const workflowIds = new Set<string>();
    for (const hint of rel.relatedWorkflowHints ?? []) {
      const needle = hint.nameIncludes.toLowerCase();
      for (const wf of workflows) {
        if (wf.product.slug !== hint.productSlug) continue;
        if (
          wf.name.toLowerCase().includes(needle) ||
          wf.key.toLowerCase().includes(needle.replace(/\s+/g, "_"))
        ) {
          workflowIds.add(wf.id);
        }
      }
    }
    if (workflowIds.size) {
      await prisma.wikiArticleWorkflow.createMany({
        data: [...workflowIds].slice(0, 5).map((workflowId) => ({ articleId, workflowId })),
        skipDuplicates: true,
      });
    }

    if (relIndex % 50 === 0 || relIndex === pendingRelations.length) {
      console.log(`  Wiki relations: ${relIndex}/${pendingRelations.length}`);
    }
  }

  const canonicalKeys = new Set(
    WIKI_CATEGORIES.flatMap((category) =>
      category.articles.map((article) => `${category.slug}:${article.slug}`)
    )
  );
  const published = await prisma.wikiArticle.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, category: { select: { slug: true } } },
  });
  const nonCanonicalIds = published
    .filter((article) => !canonicalKeys.has(`${article.category.slug}:${article.slug}`))
    .map((article) => article.id);
  if (nonCanonicalIds.length) {
    await prisma.wikiArticle.updateMany({
      where: { id: { in: nonCanonicalIds } },
      data: { status: "ARCHIVED" },
    });
  }

  const count = await prisma.wikiArticle.count({ where: { status: "PUBLISHED" } });
  if (count !== wikiArticleCount()) {
    throw new Error(
      `Wiki seed incomplete: expected ${wikiArticleCount()} published articles, got ${count}`
    );
  }

  return { categories: WIKI_CATEGORIES.length, articles: count };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-wiki.ts");
if (isDirectRun) {
  void (async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { config } = await import("dotenv");
    const { resolve } = await import("path");
    config({ path: resolve(__dirname, "../../../.env") });
    const prisma = new PrismaClient();
    const result = await seedAgencyWiki(prisma);
    console.log(`Agency Wiki seed: ${result.categories} categories, ${result.articles} published articles`);
    await prisma.$disconnect();
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
