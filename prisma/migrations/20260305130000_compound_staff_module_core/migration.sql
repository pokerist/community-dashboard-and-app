-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CompoundStaffStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."CompoundStaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CompoundStaffPermission'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."CompoundStaffPermission" AS ENUM ('ENTRY_EXIT', 'WORK_ORDERS', 'ATTENDANCE', 'RESIDENT_COMMUNICATION', 'TASK_REMINDERS');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CompoundStaff" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profession" TEXT NOT NULL,
  "workSchedule" JSONB,
  "contractFrom" TIMESTAMP(3),
  "contractTo" TIMESTAMP(3),
  "status" "public"."CompoundStaffStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CompoundStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CompoundStaffAccess" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "permission" "public"."CompoundStaffPermission" NOT NULL,
  "isGranted" BOOLEAN NOT NULL DEFAULT true,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CompoundStaffAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompoundStaff_userId_idx" ON "public"."CompoundStaff"("userId");
CREATE INDEX IF NOT EXISTS "CompoundStaff_status_idx" ON "public"."CompoundStaff"("status");
CREATE INDEX IF NOT EXISTS "CompoundStaff_deletedAt_idx" ON "public"."CompoundStaff"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompoundStaffAccess_staffId_permission_key"
  ON "public"."CompoundStaffAccess"("staffId", "permission");
CREATE INDEX IF NOT EXISTS "CompoundStaffAccess_staffId_idx" ON "public"."CompoundStaffAccess"("staffId");
CREATE INDEX IF NOT EXISTS "CompoundStaffAccess_permission_idx" ON "public"."CompoundStaffAccess"("permission");
CREATE INDEX IF NOT EXISTS "CompoundStaffAccess_grantedById_idx" ON "public"."CompoundStaffAccess"("grantedById");
CREATE INDEX IF NOT EXISTS "CompoundStaffAccess_deletedAt_idx" ON "public"."CompoundStaffAccess"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompoundStaff_userId_fkey'
  ) THEN
    ALTER TABLE "public"."CompoundStaff"
      ADD CONSTRAINT "CompoundStaff_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompoundStaffAccess_staffId_fkey'
  ) THEN
    ALTER TABLE "public"."CompoundStaffAccess"
      ADD CONSTRAINT "CompoundStaffAccess_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "public"."CompoundStaff"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompoundStaffAccess_grantedById_fkey'
  ) THEN
    ALTER TABLE "public"."CompoundStaffAccess"
      ADD CONSTRAINT "CompoundStaffAccess_grantedById_fkey"
      FOREIGN KEY ("grantedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
