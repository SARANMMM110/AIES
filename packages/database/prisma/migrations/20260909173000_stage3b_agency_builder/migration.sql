-- CreateTable
CREATE TABLE "user_product_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aiPlatform" TEXT,
    "agencyName" TEXT,
    "country" TEXT,
    "targetNiche" TEXT,
    "geographicServiceArea" TEXT,
    "experienceLevel" TEXT,
    "preferredDeliveryModel" TEXT,
    "weeklyTimeAvailability" TEXT,
    "monthlyIncomeOrClientTarget" TEXT,
    "selectedServiceIds" JSONB NOT NULL DEFAULT '[]',
    "extras" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_product_configs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "serviceArea" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "targetCustomers" TEXT,
ADD COLUMN     "currentProcess" TEXT,
ADD COLUMN     "existingTools" TEXT,
ADD COLUMN     "marketingChannels" TEXT,
ADD COLUMN     "mainProblems" TEXT,
ADD COLUMN     "goals" TEXT;

-- AlterTable (contentPending already present from earlier Stage 3 work)
ALTER TABLE "workflow_definitions" ADD COLUMN     "aiInstructionTemplate" TEXT,
ADD COLUMN     "nextAction" TEXT;

-- CreateIndex
CREATE INDEX "user_product_configs_productId_idx" ON "user_product_configs"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "user_product_configs_userId_productId_key" ON "user_product_configs"("userId", "productId");

-- AddForeignKey
ALTER TABLE "user_product_configs" ADD CONSTRAINT "user_product_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_product_configs" ADD CONSTRAINT "user_product_configs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
