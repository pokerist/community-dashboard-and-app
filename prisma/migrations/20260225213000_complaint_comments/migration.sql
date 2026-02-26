-- CreateTable
CREATE TABLE "ComplaintComment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplaintComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplaintComment_complaintId_createdAt_idx" ON "ComplaintComment"("complaintId", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintComment_createdById_idx" ON "ComplaintComment"("createdById");

-- AddForeignKey
ALTER TABLE "ComplaintComment" ADD CONSTRAINT "ComplaintComment_complaintId_fkey"
FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintComment" ADD CONSTRAINT "ComplaintComment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

