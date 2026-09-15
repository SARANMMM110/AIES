ALTER TABLE "reseller_offers" ADD COLUMN "salesCopy" TEXT;
ALTER TABLE "reseller_offers" ADD COLUMN "ctaText" TEXT;
CREATE INDEX "reseller_offers_entitlementId_idx" ON "reseller_offers"("entitlementId");

CREATE TABLE "reseller_branding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT,
    "logoPath" TEXT,
    "faviconPath" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "supportEmail" TEXT,
    "website" TEXT,
    "supportPhone" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reseller_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reseller_branding_userId_key" ON "reseller_branding"("userId");
ALTER TABLE "reseller_branding" ADD CONSTRAINT "reseller_branding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ResellerOfferEventType" AS ENUM ('VIEW', 'CHECKOUT_START');

CREATE TABLE "reseller_offer_events" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "resellerUserId" TEXT NOT NULL,
    "type" "ResellerOfferEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reseller_offer_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reseller_offer_events_resellerUserId_type_createdAt_idx" ON "reseller_offer_events"("resellerUserId", "type", "createdAt");
CREATE INDEX "reseller_offer_events_offerId_type_idx" ON "reseller_offer_events"("offerId", "type");
ALTER TABLE "reseller_offer_events" ADD CONSTRAINT "reseller_offer_events_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reseller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
