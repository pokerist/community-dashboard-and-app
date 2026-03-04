-- Create communities master table
CREATE TABLE "public"."Community" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Community_name_key" ON "public"."Community"("name");
CREATE UNIQUE INDEX "Community_code_key" ON "public"."Community"("code");

-- Unit -> Community relation
ALTER TABLE "public"."Unit"
  ADD COLUMN "communityId" TEXT;

CREATE INDEX "Unit_communityId_idx" ON "public"."Unit"("communityId");

ALTER TABLE "public"."Unit"
  ADD CONSTRAINT "Unit_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Access QR snapshot/display fields
ALTER TABLE "public"."AccessQRCode"
  ADD COLUMN "requesterNameSnapshot" TEXT,
  ADD COLUMN "requesterPhoneSnapshot" TEXT,
  ADD COLUMN "qrImageBase64" TEXT;
