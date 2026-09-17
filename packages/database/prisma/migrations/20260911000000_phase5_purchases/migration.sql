-- Phase 5 purchases (required for fresh installs)

CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "PurchaseType" AS ENUM ('PRODUCT', 'MULTI_PRODUCT', 'BUNDLE');
CREATE TYPE "PurchaseItemType" AS ENUM ('PRODUCT', 'BUNDLE');

CREATE TABLE "purchases" (
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

CREATE TABLE "purchase_items" (
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

CREATE UNIQUE INDEX "purchases_code_key" ON "purchases"("code");
CREATE INDEX "purchases_userId_createdAt_idx" ON "purchases"("userId", "createdAt");
CREATE INDEX "purchases_status_idx" ON "purchases"("status");
CREATE INDEX "purchases_purchaseType_idx" ON "purchases"("purchaseType");
CREATE INDEX "purchases_paymentStatus_idx" ON "purchases"("paymentStatus");

CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");
CREATE INDEX "purchase_items_productId_idx" ON "purchase_items"("productId");
CREATE INDEX "purchase_items_bundleId_idx" ON "purchase_items"("bundleId");

ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
