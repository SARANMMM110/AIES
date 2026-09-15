-- Saved branded agencies and sales-page inquiries. Does not add catalog products.

CREATE TABLE "reseller_agency_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "offerId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brandName" TEXT,
    "logoPath" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "supportEmail" TEXT,
    "website" TEXT,
    "supportPhone" TEXT,
    "footerText" TEXT,
    "wordpressUrl" TEXT,
    "wordpressPageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reseller_agency_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_inquiries" (
    "id" TEXT NOT NULL,
    "resellerUserId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reseller_agency_profiles_slug_key" ON "reseller_agency_profiles"("slug");
CREATE INDEX "reseller_agency_profiles_userId_published_idx" ON "reseller_agency_profiles"("userId", "published");
CREATE INDEX "reseller_agency_profiles_productId_idx" ON "reseller_agency_profiles"("productId");
CREATE INDEX "reseller_inquiries_resellerUserId_createdAt_idx" ON "reseller_inquiries"("resellerUserId", "createdAt");
CREATE INDEX "reseller_inquiries_profileId_idx" ON "reseller_inquiries"("profileId");

ALTER TABLE "reseller_agency_profiles" ADD CONSTRAINT "reseller_agency_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_agency_profiles" ADD CONSTRAINT "reseller_agency_profiles_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reseller_agency_profiles" ADD CONSTRAINT "reseller_agency_profiles_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reseller_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_inquiries" ADD CONSTRAINT "reseller_inquiries_resellerUserId_fkey" FOREIGN KEY ("resellerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_inquiries" ADD CONSTRAINT "reseller_inquiries_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "reseller_agency_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
