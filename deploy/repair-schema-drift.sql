-- Idempotent repair for known schema drift on production DBs.
-- Safe to re-run.

ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "icon" TEXT;
ALTER TABLE "bundles" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "bundles_displayOrder_idx" ON "bundles"("displayOrder");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "providerSessionId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "payment_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "eventType" TEXT NOT NULL,
    "amountVerified" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB,
    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "payment_events" ADD COLUMN IF NOT EXISTS "resellerSaleId" TEXT;

CREATE TABLE IF NOT EXISTS "sales_inquiries" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "bundleId" TEXT,
    "interest" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
