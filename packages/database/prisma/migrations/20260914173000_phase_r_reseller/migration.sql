-- Phase R: customer reseller + white-label layer (not a catalog product)

ALTER TYPE "AccessSource" ADD VALUE 'RESELLER';

CREATE TYPE "ResellerScope" AS ENUM ('PRODUCT', 'BUNDLE', 'COMPLETE_SUITE');
CREATE TYPE "ResellerEntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "ResellerOfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ResellerSaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "ResellerCustomerStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "reseller_policies" (
  "id" TEXT NOT NULL,
  "scope" "ResellerScope" NOT NULL,
  "productId" TEXT,
  "bundleId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "allowBranding" BOOLEAN NOT NULL DEFAULT true,
  "minPriceCents" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reseller_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_entitlements" (
  "id" TEXT NOT NULL,
  "entitlementKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" "ResellerScope" NOT NULL,
  "status" "ResellerEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "productId" TEXT,
  "bundleId" TEXT,
  "purchaseId" TEXT,
  "coveredProductIds" JSONB NOT NULL,
  "policySnapshot" JSONB,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reseller_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_offers" (
  "id" TEXT NOT NULL,
  "resellerUserId" TEXT NOT NULL,
  "entitlementId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "ResellerOfferStatus" NOT NULL DEFAULT 'DRAFT',
  "brandName" TEXT,
  "brandLogoUrl" TEXT,
  "brandAccent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reseller_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_offer_products" (
  "offerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "reseller_offer_products_pkey" PRIMARY KEY ("offerId", "productId")
);

CREATE TABLE "reseller_customers" (
  "id" TEXT NOT NULL,
  "resellerUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "company" TEXT,
  "notes" TEXT,
  "status" "ResellerCustomerStatus" NOT NULL DEFAULT 'INVITED',
  "userId" TEXT,
  "activationTokenHash" TEXT,
  "activationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reseller_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_sales" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "resellerUserId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" "ResellerSaleStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentNote" TEXT,
  "accessProvisionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reseller_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reseller_customer_access" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productAccessId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reseller_customer_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reseller_policies_productId_key" ON "reseller_policies"("productId");
CREATE UNIQUE INDEX "reseller_policies_bundleId_key" ON "reseller_policies"("bundleId");
CREATE INDEX "reseller_policies_scope_enabled_idx" ON "reseller_policies"("scope", "enabled");

CREATE UNIQUE INDEX "reseller_entitlements_entitlementKey_key" ON "reseller_entitlements"("entitlementKey");
CREATE INDEX "reseller_entitlements_userId_status_idx" ON "reseller_entitlements"("userId", "status");
CREATE INDEX "reseller_entitlements_purchaseId_idx" ON "reseller_entitlements"("purchaseId");

CREATE UNIQUE INDEX "reseller_offers_slug_key" ON "reseller_offers"("slug");
CREATE INDEX "reseller_offers_resellerUserId_status_idx" ON "reseller_offers"("resellerUserId", "status");

CREATE INDEX "reseller_offer_products_productId_idx" ON "reseller_offer_products"("productId");

CREATE UNIQUE INDEX "reseller_customers_resellerUserId_email_key" ON "reseller_customers"("resellerUserId", "email");
CREATE UNIQUE INDEX "reseller_customers_activationTokenHash_key" ON "reseller_customers"("activationTokenHash");
CREATE INDEX "reseller_customers_userId_idx" ON "reseller_customers"("userId");

CREATE UNIQUE INDEX "reseller_sales_code_key" ON "reseller_sales"("code");
CREATE INDEX "reseller_sales_resellerUserId_createdAt_idx" ON "reseller_sales"("resellerUserId", "createdAt");
CREATE INDEX "reseller_sales_offerId_idx" ON "reseller_sales"("offerId");

CREATE UNIQUE INDEX "reseller_customer_access_saleId_productId_key" ON "reseller_customer_access"("saleId", "productId");
CREATE INDEX "reseller_customer_access_userId_productId_idx" ON "reseller_customer_access"("userId", "productId");

ALTER TABLE "reseller_policies" ADD CONSTRAINT "reseller_policies_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_policies" ADD CONSTRAINT "reseller_policies_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reseller_entitlements" ADD CONSTRAINT "reseller_entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_entitlements" ADD CONSTRAINT "reseller_entitlements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_entitlements" ADD CONSTRAINT "reseller_entitlements_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_entitlements" ADD CONSTRAINT "reseller_entitlements_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reseller_offers" ADD CONSTRAINT "reseller_offers_resellerUserId_fkey" FOREIGN KEY ("resellerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_offers" ADD CONSTRAINT "reseller_offers_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "reseller_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reseller_offer_products" ADD CONSTRAINT "reseller_offer_products_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reseller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_offer_products" ADD CONSTRAINT "reseller_offer_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reseller_customers" ADD CONSTRAINT "reseller_customers_resellerUserId_fkey" FOREIGN KEY ("resellerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_customers" ADD CONSTRAINT "reseller_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reseller_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_resellerUserId_fkey" FOREIGN KEY ("resellerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "reseller_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reseller_customer_access" ADD CONSTRAINT "reseller_customer_access_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "reseller_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_customer_access" ADD CONSTRAINT "reseller_customer_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_customer_access" ADD CONSTRAINT "reseller_customer_access_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reseller_customer_access" ADD CONSTRAINT "reseller_customer_access_productAccessId_fkey" FOREIGN KEY ("productAccessId") REFERENCES "product_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;
