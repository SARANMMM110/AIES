-- Bundle marketing / catalog fields (were in schema via db push; missing from SQL migrations)

ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "bundles_displayOrder_idx" ON "bundles"("displayOrder");
