-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'GateAccessRole'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."GateAccessRole" AS ENUM ('RESIDENT', 'VISITOR', 'WORKER', 'STAFF', 'DELIVERY', 'RIDESHARE');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'GateDirection'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."GateDirection" AS ENUM ('ENTRY', 'EXIT');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'GateScanResult'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."GateScanResult" AS ENUM ('ALLOWED', 'DENIED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Gate" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "status" "public"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "allowedRoles" "public"."GateAccessRole"[] DEFAULT ARRAY['VISITOR']::"public"."GateAccessRole"[],
  "etaMinutes" INTEGER NOT NULL DEFAULT 0,
  "isVisitorRequestRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."GateUnitAccess" (
  "id" TEXT NOT NULL,
  "gateId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "GateUnitAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."GateEntryLog" (
  "id" TEXT NOT NULL,
  "gateId" TEXT,
  "qrCodeId" TEXT,
  "unitId" TEXT,
  "direction" "public"."GateDirection" NOT NULL,
  "result" "public"."GateScanResult" NOT NULL DEFAULT 'ALLOWED',
  "scanRole" "public"."GateAccessRole",
  "operatorUserId" TEXT,
  "visitorNameSnapshot" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "GateEntryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Gate_communityId_idx" ON "public"."Gate"("communityId");
CREATE INDEX IF NOT EXISTS "Gate_status_idx" ON "public"."Gate"("status");
CREATE INDEX IF NOT EXISTS "Gate_deletedAt_idx" ON "public"."Gate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GateUnitAccess_gateId_unitId_key" ON "public"."GateUnitAccess"("gateId", "unitId");
CREATE INDEX IF NOT EXISTS "GateUnitAccess_gateId_idx" ON "public"."GateUnitAccess"("gateId");
CREATE INDEX IF NOT EXISTS "GateUnitAccess_unitId_idx" ON "public"."GateUnitAccess"("unitId");
CREATE INDEX IF NOT EXISTS "GateUnitAccess_deletedAt_idx" ON "public"."GateUnitAccess"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GateEntryLog_gateId_idx" ON "public"."GateEntryLog"("gateId");
CREATE INDEX IF NOT EXISTS "GateEntryLog_qrCodeId_idx" ON "public"."GateEntryLog"("qrCodeId");
CREATE INDEX IF NOT EXISTS "GateEntryLog_unitId_idx" ON "public"."GateEntryLog"("unitId");
CREATE INDEX IF NOT EXISTS "GateEntryLog_operatorUserId_idx" ON "public"."GateEntryLog"("operatorUserId");
CREATE INDEX IF NOT EXISTS "GateEntryLog_scannedAt_idx" ON "public"."GateEntryLog"("scannedAt");
CREATE INDEX IF NOT EXISTS "GateEntryLog_direction_idx" ON "public"."GateEntryLog"("direction");
CREATE INDEX IF NOT EXISTS "GateEntryLog_result_idx" ON "public"."GateEntryLog"("result");
CREATE INDEX IF NOT EXISTS "GateEntryLog_deletedAt_idx" ON "public"."GateEntryLog"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Gate_communityId_fkey'
  ) THEN
    ALTER TABLE "public"."Gate"
      ADD CONSTRAINT "Gate_communityId_fkey"
      FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateUnitAccess_gateId_fkey'
  ) THEN
    ALTER TABLE "public"."GateUnitAccess"
      ADD CONSTRAINT "GateUnitAccess_gateId_fkey"
      FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateUnitAccess_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."GateUnitAccess"
      ADD CONSTRAINT "GateUnitAccess_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateEntryLog_gateId_fkey'
  ) THEN
    ALTER TABLE "public"."GateEntryLog"
      ADD CONSTRAINT "GateEntryLog_gateId_fkey"
      FOREIGN KEY ("gateId") REFERENCES "public"."Gate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateEntryLog_qrCodeId_fkey'
  ) THEN
    ALTER TABLE "public"."GateEntryLog"
      ADD CONSTRAINT "GateEntryLog_qrCodeId_fkey"
      FOREIGN KEY ("qrCodeId") REFERENCES "public"."AccessQRCode"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateEntryLog_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."GateEntryLog"
      ADD CONSTRAINT "GateEntryLog_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GateEntryLog_operatorUserId_fkey'
  ) THEN
    ALTER TABLE "public"."GateEntryLog"
      ADD CONSTRAINT "GateEntryLog_operatorUserId_fkey"
      FOREIGN KEY ("operatorUserId") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

