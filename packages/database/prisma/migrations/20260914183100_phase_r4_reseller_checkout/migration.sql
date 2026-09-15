UPDATE "reseller_offers" SET "status" = 'PUBLISHED' WHERE "status" = 'ACTIVE';
UPDATE "reseller_offers" SET "status" = 'UNPUBLISHED' WHERE "status" = 'PAUSED';
UPDATE "reseller_sales" SET "status" = 'PAID' WHERE "status" = 'COMPLETED';

ALTER TABLE "reseller_sales" ADD COLUMN "productId" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "bundleId" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "paymentProvider" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "checkoutReference" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "refundReference" TEXT;
ALTER TABLE "reseller_sales" ADD COLUMN "snapshot" JSONB;
ALTER TABLE "reseller_sales" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "reseller_sales" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "reseller_sales" ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "reseller_sales_paymentReference_key" ON "reseller_sales"("paymentReference");
CREATE UNIQUE INDEX "reseller_sales_checkoutReference_key" ON "reseller_sales"("checkoutReference");
CREATE INDEX "reseller_sales_status_idx" ON "reseller_sales"("status");
CREATE INDEX "reseller_sales_customerId_idx" ON "reseller_sales"("customerId");

ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_events" ADD COLUMN "resellerSaleId" TEXT;
CREATE INDEX "payment_events_resellerSaleId_idx" ON "payment_events"("resellerSaleId");
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_resellerSaleId_fkey" FOREIGN KEY ("resellerSaleId") REFERENCES "reseller_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
