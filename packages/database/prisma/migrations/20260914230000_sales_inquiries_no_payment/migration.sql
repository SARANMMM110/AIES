-- AES sales inquiries (no payment). Reseller inquiries may come from an offer without a branded agency profile.

CREATE TABLE "sales_inquiries" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sales_inquiries_createdAt_idx" ON "sales_inquiries"("createdAt");
CREATE INDEX "sales_inquiries_status_idx" ON "sales_inquiries"("status");
CREATE INDEX "sales_inquiries_email_idx" ON "sales_inquiries"("email");

ALTER TABLE "sales_inquiries" ADD CONSTRAINT "sales_inquiries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_inquiries" ADD CONSTRAINT "sales_inquiries_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reseller_inquiries" ALTER COLUMN "profileId" DROP NOT NULL;
ALTER TABLE "reseller_inquiries" ADD COLUMN "offerId" TEXT;
CREATE INDEX "reseller_inquiries_offerId_idx" ON "reseller_inquiries"("offerId");
ALTER TABLE "reseller_inquiries" ADD CONSTRAINT "reseller_inquiries_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reseller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
