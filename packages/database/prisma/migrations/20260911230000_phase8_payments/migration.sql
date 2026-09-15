-- Phase 8: payment provider fields + webhook idempotency

ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "providerSessionId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

ALTER TABLE "purchases" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "purchases" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS "purchases_paymentStatus_idx" ON "purchases"("paymentStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_providerSessionId_key" ON "purchases"("providerSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_providerPaymentId_key" ON "purchases"("providerPaymentId");

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

CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_eventId_key" ON "payment_events"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "payment_events_purchaseId_idx" ON "payment_events"("purchaseId");

DO $$ BEGIN
  ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
