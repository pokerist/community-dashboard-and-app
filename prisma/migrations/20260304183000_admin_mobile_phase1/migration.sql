-- Add approval delivery status enum
CREATE TYPE "ApprovalDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- Service ordering support
ALTER TABLE "Service"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Gate operations lifecycle fields for access QR
ALTER TABLE "AccessQRCode"
  ADD COLUMN "checkedInAt" TIMESTAMP(3),
  ADD COLUMN "checkedOutAt" TIMESTAMP(3),
  ADD COLUMN "gateOperatorId" TEXT,
  ADD COLUMN "overdueExitAt" TIMESTAMP(3),
  ADD COLUMN "arrivalNotifiedAt" TIMESTAMP(3);

ALTER TABLE "AccessQRCode"
  ADD CONSTRAINT "AccessQRCode_gateOperatorId_fkey"
  FOREIGN KEY ("gateOperatorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AccessQRCode_unitId_status_createdAt_idx" ON "AccessQRCode"("unitId", "status", "createdAt");
CREATE INDEX "AccessQRCode_checkedInAt_checkedOutAt_idx" ON "AccessQRCode"("checkedInAt", "checkedOutAt");

-- Approval center credential delivery tracking
ALTER TABLE "FamilyAccessRequest"
  ADD COLUMN "credentialsEmailStatus" "ApprovalDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "credentialsEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "credentialsEmailError" TEXT;

ALTER TABLE "AuthorizedAccessRequest"
  ADD COLUMN "credentialsEmailStatus" "ApprovalDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "credentialsEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "credentialsEmailError" TEXT;
