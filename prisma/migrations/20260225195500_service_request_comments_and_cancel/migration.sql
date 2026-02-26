-- Add CANCELLED to service request lifecycle
ALTER TYPE "ServiceRequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- CreateTable
CREATE TABLE "ServiceRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequestComment_requestId_createdAt_idx" ON "ServiceRequestComment"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequestComment_createdById_idx" ON "ServiceRequestComment"("createdById");

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

