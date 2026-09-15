import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";
import { AGENCY_CATALOG } from "../packages/database/prisma/content/agency-catalog";
import { buildAllWorkflows } from "../packages/database/prisma/content/workflow-catalog";
import { WIKI_CATEGORIES, wikiArticleCount } from "../packages/database/prisma/content/wiki-catalog";

async function main() {
  const canonical = buildAllWorkflows(AGENCY_CATALOG);
  const canonicalKeys = new Set<string>();
  for (const [slug, list] of Object.entries(canonical.byAgency)) {
    for (const wf of list) canonicalKeys.add(`${slug}:${wf.key}`);
  }

  const workflows = await prisma.workflowDefinition.findMany({
    include: {
      product: { select: { slug: true, name: true } },
      serviceResource: { select: { title: true, slug: true } },
      _count: { select: { progress: true, wikiArticleLinks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const extras = workflows.filter((wf) => !canonicalKeys.has(`${wf.product.slug}:${wf.key}`));
  const missing = [...canonicalKeys].filter(
    (key) => !workflows.some((wf) => `${wf.product.slug}:${wf.key}` === key)
  );

  console.log(JSON.stringify({
    workflowDb: workflows.length,
    workflowCanonical: canonical.total,
    extraWorkflows: extras.map((wf) => ({
      id: wf.id,
      key: wf.key,
      name: wf.name,
      product: wf.product.slug,
      service: wf.serviceResource?.title ?? null,
      isActive: wf.isActive,
      contentPending: wf.contentPending,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      progress: wf._count.progress,
      wikiLinks: wf._count.wikiArticleLinks,
    })),
    missingCanonicalWorkflows: missing,
  }, null, 2));

  const canonicalArticles = new Set(
    WIKI_CATEGORIES.flatMap((cat) => cat.articles.map((article) => `${cat.slug}:${article.slug}`))
  );
  console.log("canonical wiki articles", wikiArticleCount(), "unique", canonicalArticles.size);

  const articles = await prisma.wikiArticle.findMany({
    where: { status: "PUBLISHED" },
    include: {
      category: { select: { slug: true, name: true } },
      _count: { select: { bookmarks: true, progress: true, history: true, relatedWorkflows: true, relatedAgencies: true, relatedFrom: true, relatedTo: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const extraArticles = articles.filter((article) => !canonicalArticles.has(`${article.category.slug}:${article.slug}`));
  const missingArticles = [...canonicalArticles].filter(
    (key) => !articles.some((article) => `${article.category.slug}:${article.slug}` === key)
  );
  console.log(JSON.stringify({
    wikiPublished: articles.length,
    extraArticles: extraArticles.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      category: article.category.slug,
      status: article.status,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      keywords: article.keywords,
      refs: article._count,
    })),
    missingCanonicalArticles: missingArticles,
  }, null, 2));

  const [
    workflowResults,
    workflowProgress,
    projects,
    services,
    agencies,
    wikiArticles,
    wikiLinks,
    wikiRelated,
    bookmarks,
    wikiProgress,
    wikiHistory,
  ] = await Promise.all([
    prisma.workflowResult.count(),
    prisma.workflowProgress.count(),
    prisma.project.count(),
    prisma.productResource.count({ where: { type: "SERVICE" } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.wikiArticle.count(),
    prisma.wikiArticleWorkflow.count(),
    prisma.wikiArticleRelatedArticle.count(),
    prisma.userWikiBookmark.count(),
    prisma.userWikiProgress.count(),
    prisma.userWikiHistory.count(),
  ]);
  const orphans = await prisma.$queryRaw<Array<{ name: string; orphans: bigint }>>`
    SELECT 'workflow_progress_project' AS name, count(*)::bigint AS orphans FROM workflow_progress p LEFT JOIN projects j ON j.id = p."projectId" WHERE j.id IS NULL
    UNION ALL SELECT 'workflow_progress_workflow', count(*)::bigint FROM workflow_progress p LEFT JOIN workflow_definitions j ON j.id = p."workflowId" WHERE p."workflowId" IS NOT NULL AND j.id IS NULL
    UNION ALL SELECT 'workflow_result_project', count(*)::bigint FROM workflow_results p LEFT JOIN projects j ON j.id = p."projectId" WHERE j.id IS NULL
    UNION ALL SELECT 'workflow_result_owner', count(*)::bigint FROM workflow_results p LEFT JOIN users j ON j.id = p."ownerId" WHERE j.id IS NULL
    UNION ALL SELECT 'wiki_article_workflow', count(*)::bigint FROM wiki_article_workflows p LEFT JOIN wiki_articles a ON a.id = p."articleId" LEFT JOIN workflow_definitions w ON w.id = p."workflowId" WHERE a.id IS NULL OR w.id IS NULL
    UNION ALL SELECT 'wiki_related', count(*)::bigint FROM wiki_article_related p LEFT JOIN wiki_articles a ON a.id = p."articleId" LEFT JOIN wiki_articles b ON b.id = p."relatedArticleId" WHERE a.id IS NULL OR b.id IS NULL
    UNION ALL SELECT 'wiki_bookmark', count(*)::bigint FROM user_wiki_bookmarks p LEFT JOIN wiki_articles a ON a.id = p."articleId" WHERE a.id IS NULL
    UNION ALL SELECT 'wiki_progress', count(*)::bigint FROM user_wiki_progress p LEFT JOIN wiki_articles a ON a.id = p."articleId" WHERE a.id IS NULL
    UNION ALL SELECT 'wiki_history', count(*)::bigint FROM user_wiki_history p LEFT JOIN wiki_articles a ON a.id = p."articleId" WHERE a.id IS NULL
  `;
  const sampleResult = await prisma.workflowResult.findFirst({
    where: { id: "cmtu8t09n000qbs1spjymmwtz" },
    select: { id: true, title: true, workflowKey: true },
  });
  const archivedSmoke = await prisma.wikiArticle.count({
    where: { slug: { startsWith: "smoke-wiki-article-" }, status: "ARCHIVED" },
  });
  console.log(JSON.stringify({
    integrity: {
      workflowResults,
      workflowProgress,
      projects,
      services,
      agencies,
      wikiArticles,
      wikiLinks,
      wikiRelated,
      bookmarks,
      wikiProgress,
      wikiHistory,
      orphans: orphans.map((row) => ({ name: row.name, orphans: Number(row.orphans) })),
      sampleResultPreserved: sampleResult,
      archivedSmoke,
    },
  }));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
