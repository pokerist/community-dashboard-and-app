-- Add ownership transfer mode enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OwnershipTransferMode'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."OwnershipTransferMode" AS ENUM ('MOVE_EXISTING_PLAN', 'CREATE_NEW_PLAN');
  END IF;
END $$;

-- Add archivedAt to owner contracts
ALTER TABLE "public"."OwnerUnitContract"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Create transfer audit table
CREATE TABLE IF NOT EXISTS "public"."UnitOwnershipTransfer" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "transferMode" "public"."OwnershipTransferMode" NOT NULL,
  "movedContractId" TEXT,
  "createdContractId" TEXT,
  "transferredInstallmentsCount" INTEGER NOT NULL DEFAULT 0,
  "transferredById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UnitOwnershipTransfer_unitId_createdAt_idx"
  ON "public"."UnitOwnershipTransfer"("unitId", "createdAt");
CREATE INDEX IF NOT EXISTS "UnitOwnershipTransfer_fromUserId_createdAt_idx"
  ON "public"."UnitOwnershipTransfer"("fromUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "UnitOwnershipTransfer_toUserId_createdAt_idx"
  ON "public"."UnitOwnershipTransfer"("toUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitOwnershipTransfer_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."UnitOwnershipTransfer"
      ADD CONSTRAINT "UnitOwnershipTransfer_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitOwnershipTransfer_fromUserId_fkey'
  ) THEN
    ALTER TABLE "public"."UnitOwnershipTransfer"
      ADD CONSTRAINT "UnitOwnershipTransfer_fromUserId_fkey"
      FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitOwnershipTransfer_toUserId_fkey'
  ) THEN
    ALTER TABLE "public"."UnitOwnershipTransfer"
      ADD CONSTRAINT "UnitOwnershipTransfer_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitOwnershipTransfer_transferredById_fkey'
  ) THEN
    ALTER TABLE "public"."UnitOwnershipTransfer"
      ADD CONSTRAINT "UnitOwnershipTransfer_transferredById_fkey"
      FOREIGN KEY ("transferredById") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
