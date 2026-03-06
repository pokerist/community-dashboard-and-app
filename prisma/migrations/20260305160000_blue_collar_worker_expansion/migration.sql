-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BlueCollarRequestStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."BlueCollarRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'BlueCollarWeekDay'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."BlueCollarWeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."BlueCollarSetting" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "workDays" "public"."BlueCollarWeekDay"[] DEFAULT ARRAY[]::"public"."BlueCollarWeekDay"[],
  "workStartTime" TEXT,
  "workEndTime" TEXT,
  "holidays" JSONB,
  "termsAndConditions" TEXT,
  "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BlueCollarSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."BlueCollarAccessRequest" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "settingId" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "qrCodeId" TEXT,
  "idDocumentRef" TEXT,
  "status" "public"."BlueCollarRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedValidFrom" TIMESTAMP(3) NOT NULL,
  "requestedValidTo" TIMESTAMP(3) NOT NULL,
  "gates" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BlueCollarAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlueCollarSetting_communityId_key"
  ON "public"."BlueCollarSetting"("communityId");
CREATE INDEX IF NOT EXISTS "BlueCollarSetting_communityId_idx" ON "public"."BlueCollarSetting"("communityId");
CREATE INDEX IF NOT EXISTS "BlueCollarSetting_createdById_idx" ON "public"."BlueCollarSetting"("createdById");
CREATE INDEX IF NOT EXISTS "BlueCollarSetting_updatedById_idx" ON "public"."BlueCollarSetting"("updatedById");
CREATE INDEX IF NOT EXISTS "BlueCollarSetting_deletedAt_idx" ON "public"."BlueCollarSetting"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlueCollarAccessRequest_qrCodeId_key"
  ON "public"."BlueCollarAccessRequest"("qrCodeId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_workerId_idx" ON "public"."BlueCollarAccessRequest"("workerId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_unitId_idx" ON "public"."BlueCollarAccessRequest"("unitId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_contractorId_idx" ON "public"."BlueCollarAccessRequest"("contractorId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_settingId_idx" ON "public"."BlueCollarAccessRequest"("settingId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_requestedById_idx" ON "public"."BlueCollarAccessRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_reviewedById_idx" ON "public"."BlueCollarAccessRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_qrCodeId_idx" ON "public"."BlueCollarAccessRequest"("qrCodeId");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_status_idx" ON "public"."BlueCollarAccessRequest"("status");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_createdAt_idx" ON "public"."BlueCollarAccessRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "BlueCollarAccessRequest_deletedAt_idx" ON "public"."BlueCollarAccessRequest"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarSetting_communityId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarSetting"
      ADD CONSTRAINT "BlueCollarSetting_communityId_fkey"
      FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarSetting_createdById_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarSetting"
      ADD CONSTRAINT "BlueCollarSetting_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarSetting_updatedById_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarSetting"
      ADD CONSTRAINT "BlueCollarSetting_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_workerId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_workerId_fkey"
      FOREIGN KEY ("workerId") REFERENCES "public"."Worker"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_contractorId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_contractorId_fkey"
      FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_settingId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_settingId_fkey"
      FOREIGN KEY ("settingId") REFERENCES "public"."BlueCollarSetting"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarAccessRequest_qrCodeId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarAccessRequest"
      ADD CONSTRAINT "BlueCollarAccessRequest_qrCodeId_fkey"
      FOREIGN KEY ("qrCodeId") REFERENCES "public"."AccessQRCode"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
