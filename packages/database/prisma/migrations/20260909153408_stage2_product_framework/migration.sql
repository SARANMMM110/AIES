-- AlterTable
ALTER TABLE "products" ADD COLUMN     "configuration" JSONB,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;
