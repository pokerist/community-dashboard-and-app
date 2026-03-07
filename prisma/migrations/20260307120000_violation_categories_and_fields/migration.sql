-- CreateTable
CREATE TABLE "ViolationCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultFineAmount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViolationCategory_name_key" ON "ViolationCategory"("name");

-- AlterTable
ALTER TABLE "Violation"
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "photoEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "closedAt" TIMESTAMP(3),
    ADD COLUMN "appealDeadline" TIMESTAMP(3);

-- Keep legacy data in mapped "type" column but allow null for future rows
ALTER TABLE "Violation"
    ALTER COLUMN "type" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Violation_categoryId_idx" ON "Violation"("categoryId");

-- CreateIndex
CREATE INDEX "Violation_status_appealStatus_idx" ON "Violation"("status", "appealStatus");

-- CreateIndex
CREATE INDEX "Violation_appealDeadline_idx" ON "Violation"("appealDeadline");

-- AddForeignKey
ALTER TABLE "Violation"
ADD CONSTRAINT "Violation_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ViolationCategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
