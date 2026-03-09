-- Add new ViolationStatus values
ALTER TYPE "ViolationStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "ViolationStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- Add defaultAssigneeId to ComplaintCategory
ALTER TABLE "ComplaintCategory" ADD COLUMN IF NOT EXISTS "defaultAssigneeId" TEXT;
ALTER TABLE "ComplaintCategory" ADD CONSTRAINT "ComplaintCategory_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create ViolationComment table
CREATE TABLE IF NOT EXISTS "ViolationComment" (
    "id" TEXT NOT NULL,
    "violationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViolationComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ViolationComment_violationId_createdAt_idx" ON "ViolationComment"("violationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ViolationComment_createdById_idx" ON "ViolationComment"("createdById");

ALTER TABLE "ViolationComment" ADD CONSTRAINT "ViolationComment_violationId_fkey" FOREIGN KEY ("violationId") REFERENCES "Violation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViolationComment" ADD CONSTRAINT "ViolationComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create StatusHistory table
CREATE TABLE IF NOT EXISTS "StatusHistory" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StatusHistory_entityType_entityId_createdAt_idx" ON "StatusHistory"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "StatusHistory_changedById_idx" ON "StatusHistory"("changedById");

ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
