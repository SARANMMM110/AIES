/**
 * One-time reconciliation of known non-canonical rows identified by
 * scripts/reconcile-catalog-diff.ts. Does not touch the approved 10/99/306/172 catalog.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

import { prisma } from "@aes/database";

const EXTRA_WORKFLOW_ID = "cmtu8p8ts0005bsyg181qhlr6";
const EXTRA_ARTICLE_IDS = ["cmtx9wwaq000bbs1ovgb2e9gh", "cmtxbgy7p000pbsuwiqjmekar"];

async function main() {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: EXTRA_WORKFLOW_ID },
    include: {
      product: { select: { slug: true, status: true } },
      _count: { select: { progress: true, wikiArticleLinks: true } },
    },
  });
  if (!workflow) throw new Error("extra workflow already gone");
  if (workflow.key !== "sample-onboarding" || workflow.product.slug !== "sample-agency-module") {
    throw new Error(`unexpected workflow identity ${workflow.product.slug}/${workflow.key}`);
  }
  const results = await prisma.workflowResult.findMany({
    where: { workflowKey: workflow.key },
    select: { id: true, title: true, owner: { select: { email: true } }, createdAt: true },
  });
  const progress = await prisma.workflowProgress.findMany({
    where: { OR: [{ workflowId: workflow.id }, { workflowKey: workflow.key }] },
    select: { id: true, workflowKey: true, status: true },
  });
  const resultProjects = results.length
    ? await prisma.workflowResult.findMany({
        where: { id: { in: results.map((row) => row.id) } },
        select: {
          id: true,
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              owner: { select: { email: true } },
              product: { select: { slug: true, status: true } },
              _count: { select: { workflowProgress: true, workflowResults: true } },
            },
          },
        },
      })
    : [];
  console.log(JSON.stringify({
    productStatus: workflow.product.status,
    isActive: workflow.isActive,
    progressCount: workflow._count.progress,
    wikiLinks: workflow._count.wikiArticleLinks,
    progress,
    results,
    resultProjects,
  }));
  const fkProgress = await prisma.workflowProgress.count({ where: { workflowId: workflow.id } });
  if (fkProgress || workflow._count.wikiArticleLinks) {
    throw new Error("extra workflow has foreign-key references; refusing to delete");
  }
  const allowedResult =
    results.length === 1 &&
    results[0]?.title === "Sample result" &&
    results[0]?.owner.email === "user@aies.local" &&
    resultProjects.length === 1 &&
    resultProjects[0]?.project.name === "Demo Project" &&
    resultProjects[0]?.project.product?.slug === "sample-agency-module" &&
    resultProjects[0]?.project.product?.status === "ARCHIVED" &&
    resultProjects[0]?.project._count.workflowResults === 1;
  const allowedProgress =
    progress.length === 1 &&
    progress[0]?.workflowKey === "sample-onboarding" &&
    progress[0]?.id === "cmtu8t088000obs1s72mw1v2l";
  if (!allowedResult || !allowedProgress) {
    throw new Error("extra workflow references are not the known demo leftovers; refusing to delete");
  }

  const articles = await prisma.wikiArticle.findMany({
    where: { id: { in: EXTRA_ARTICLE_IDS } },
    include: { _count: { select: { bookmarks: true, progress: true, history: true } } },
  });
  if (articles.length !== 2) throw new Error("expected exactly two smoke articles");
  for (const article of articles) {
    if (!article.slug.startsWith("smoke-wiki-article-")) {
      throw new Error(`refusing to archive non-smoke article ${article.slug}`);
    }
    if (article._count.bookmarks || article._count.progress) {
      throw new Error(`smoke article ${article.slug} has bookmarks/progress; refusing`);
    }
  }

  await prisma.$transaction([
    prisma.workflowDefinition.delete({ where: { id: workflow.id } }),
    prisma.wikiArticle.updateMany({
      where: { id: { in: EXTRA_ARTICLE_IDS } },
      data: { status: "ARCHIVED" },
    }),
  ]);

  const [products, services, workflows, categories, publishedWiki, archivedSmoke] = await Promise.all([
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.productResource.count({ where: { type: "SERVICE" } }),
    prisma.workflowDefinition.count(),
    prisma.wikiCategory.count(),
    prisma.wikiArticle.count({ where: { status: "PUBLISHED" } }),
    prisma.wikiArticle.count({ where: { id: { in: EXTRA_ARTICLE_IDS }, status: "ARCHIVED" } }),
  ]);
  console.log(JSON.stringify({
    deletedWorkflow: `${workflow.product.slug}/${workflow.key}`,
    archivedArticles: articles.map((article) => article.slug),
    historyPreserved: {
      wikiHistory: articles.map((article) => ({ slug: article.slug, history: article._count.history })),
      workflowResultId: results[0]?.id,
      workflowProgressId: progress[0]?.id,
      projectId: resultProjects[0]?.project.id,
    },
    products,
    services,
    workflows,
    categories,
    publishedWiki,
    archivedSmoke,
  }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
