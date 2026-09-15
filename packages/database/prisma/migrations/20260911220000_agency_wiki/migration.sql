-- Agency Wiki — shared platform knowledge (not a product)

CREATE TYPE "WikiStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "wiki_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "WikiStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wiki_articles" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "WikiStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wiki_article_agencies" (
    "articleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "wiki_article_agencies_pkey" PRIMARY KEY ("articleId","productId")
);

CREATE TABLE "wiki_article_workflows" (
    "articleId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "wiki_article_workflows_pkey" PRIMARY KEY ("articleId","workflowId")
);

CREATE TABLE "wiki_article_related" (
    "articleId" TEXT NOT NULL,
    "relatedArticleId" TEXT NOT NULL,

    CONSTRAINT "wiki_article_related_pkey" PRIMARY KEY ("articleId","relatedArticleId")
);

CREATE TABLE "user_wiki_bookmarks" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wiki_bookmarks_pkey" PRIMARY KEY ("userId","articleId")
);

CREATE TABLE "user_wiki_progress" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wiki_progress_pkey" PRIMARY KEY ("userId","articleId")
);

CREATE TABLE "user_wiki_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wiki_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wiki_categories_slug_key" ON "wiki_categories"("slug");
CREATE INDEX "wiki_categories_displayOrder_idx" ON "wiki_categories"("displayOrder");

CREATE UNIQUE INDEX "wiki_articles_categoryId_slug_key" ON "wiki_articles"("categoryId", "slug");
CREATE INDEX "wiki_articles_status_displayOrder_idx" ON "wiki_articles"("status", "displayOrder");
CREATE INDEX "wiki_articles_title_idx" ON "wiki_articles"("title");

CREATE INDEX "wiki_article_agencies_productId_idx" ON "wiki_article_agencies"("productId");
CREATE INDEX "wiki_article_workflows_workflowId_idx" ON "wiki_article_workflows"("workflowId");
CREATE INDEX "wiki_article_related_relatedArticleId_idx" ON "wiki_article_related"("relatedArticleId");

CREATE INDEX "user_wiki_bookmarks_articleId_idx" ON "user_wiki_bookmarks"("articleId");
CREATE INDEX "user_wiki_progress_articleId_idx" ON "user_wiki_progress"("articleId");
CREATE UNIQUE INDEX "user_wiki_history_userId_articleId_key" ON "user_wiki_history"("userId", "articleId");
CREATE INDEX "user_wiki_history_userId_viewedAt_idx" ON "user_wiki_history"("userId", "viewedAt");
CREATE INDEX "user_wiki_history_articleId_idx" ON "user_wiki_history"("articleId");

ALTER TABLE "wiki_articles" ADD CONSTRAINT "wiki_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "wiki_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_agencies" ADD CONSTRAINT "wiki_article_agencies_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_agencies" ADD CONSTRAINT "wiki_article_agencies_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_workflows" ADD CONSTRAINT "wiki_article_workflows_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_workflows" ADD CONSTRAINT "wiki_article_workflows_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_related" ADD CONSTRAINT "wiki_article_related_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiki_article_related" ADD CONSTRAINT "wiki_article_related_relatedArticleId_fkey" FOREIGN KEY ("relatedArticleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_bookmarks" ADD CONSTRAINT "user_wiki_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_bookmarks" ADD CONSTRAINT "user_wiki_bookmarks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_progress" ADD CONSTRAINT "user_wiki_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_progress" ADD CONSTRAINT "user_wiki_progress_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_history" ADD CONSTRAINT "user_wiki_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wiki_history" ADD CONSTRAINT "user_wiki_history_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "wiki_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
