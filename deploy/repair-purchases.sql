-- One-time repair for DBs where phase5_purchases was recorded as applied
-- but only contained comments (no CREATE TABLE). Safe to re-run (IF NOT EXISTS).

DO $$ BEGIN
  CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseType" AS ENUM ('PRODUCT', 'MULTI_PRODUCT', 'BUNDLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseItemType" AS ENUM ('PRODUCT', 'BUNDLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "purchases" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseType" "PurchaseType" NOT NULL,
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentNote" TEXT,
    "accessProvisionedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "itemType" "PurchaseItemType" NOT NULL,
    "productId" TEXT,
    "bundleId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchases_code_key" ON "purchases"("code");
CREATE INDEX IF NOT EXISTS "purchases_userId_createdAt_idx" ON "purchases"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "purchases_status_idx" ON "purchases"("status");
CREATE INDEX IF NOT EXISTS "purchases_purchaseType_idx" ON "purchases"("purchaseType");
CREATE INDEX IF NOT EXISTS "purchases_paymentStatus_idx" ON "purchases"("paymentStatus");
CREATE INDEX IF NOT EXISTS "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");
CREATE INDEX IF NOT EXISTS "purchase_items_productId_idx" ON "purchase_items"("productId");
CREATE INDEX IF NOT EXISTS "purchase_items_bundleId_idx" ON "purchase_items"("bundleId");

DO $$ BEGIN
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
