-- AlterTable
ALTER TABLE "workflow_definitions" ADD COLUMN     "contentPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceResourceId" TEXT;

-- CreateTable
CREATE TABLE "shared_resources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_resources_key_key" ON "shared_resources"("key");

-- CreateIndex
CREATE INDEX "workflow_definitions_serviceResourceId_idx" ON "workflow_definitions"("serviceResourceId");

-- CreateIndex
CREATE INDEX "workflow_definitions_productId_serviceResourceId_idx" ON "workflow_definitions"("productId", "serviceResourceId");

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_serviceResourceId_fkey" FOREIGN KEY ("serviceResourceId") REFERENCES "product_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
