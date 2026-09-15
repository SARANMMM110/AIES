-- AlterEnum
ALTER TYPE "ProductResourceType" ADD VALUE 'BUSINESS_STRATEGY';

-- AlterTable
ALTER TABLE "workflow_definitions" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inputs" JSONB,
ADD COLUMN     "outputDefinition" JSONB,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "reviewRequirements" JSONB;
