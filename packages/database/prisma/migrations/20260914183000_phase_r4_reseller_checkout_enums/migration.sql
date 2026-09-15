-- Add statuses used by automated reseller checkout.
-- Data updates are in the following migration so new enum values are committed first.

ALTER TYPE "ResellerOfferStatus" ADD VALUE 'PUBLISHED';
ALTER TYPE "ResellerOfferStatus" ADD VALUE 'UNPUBLISHED';
ALTER TYPE "ResellerSaleStatus" ADD VALUE 'PAID';
ALTER TYPE "ResellerSaleStatus" ADD VALUE 'FAILED';
