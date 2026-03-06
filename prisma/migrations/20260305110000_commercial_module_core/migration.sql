-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CommercialStaffRole'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."CommercialStaffRole" AS ENUM ('OWNER', 'HR', 'MANAGER', 'EMPLOYEE');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CommercialAccessPermission'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."CommercialAccessPermission" AS ENUM ('WORK_ORDERS', 'ATTENDANCE', 'SERVICE_REQUESTS', 'TICKET_HANDLING', 'PHOTO_UPLOAD', 'TASK_REMINDERS');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CommercialEntity" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "communityId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "status" "public"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CommercialBranch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "unitId" TEXT,
  "status" "public"."EntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CommercialStaff" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "role" "public"."CommercialStaffRole" NOT NULL,
  "status" "public"."MemberStatusEnum" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CommercialAccess" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "permission" "public"."CommercialAccessPermission" NOT NULL,
  "isGranted" BOOLEAN NOT NULL DEFAULT true,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CommercialAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommercialEntity_communityId_idx" ON "public"."CommercialEntity"("communityId");
CREATE INDEX IF NOT EXISTS "CommercialEntity_ownerUserId_idx" ON "public"."CommercialEntity"("ownerUserId");
CREATE INDEX IF NOT EXISTS "CommercialEntity_status_idx" ON "public"."CommercialEntity"("status");
CREATE INDEX IF NOT EXISTS "CommercialEntity_deletedAt_idx" ON "public"."CommercialEntity"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommercialBranch_entityId_idx" ON "public"."CommercialBranch"("entityId");
CREATE INDEX IF NOT EXISTS "CommercialBranch_unitId_idx" ON "public"."CommercialBranch"("unitId");
CREATE INDEX IF NOT EXISTS "CommercialBranch_status_idx" ON "public"."CommercialBranch"("status");
CREATE INDEX IF NOT EXISTS "CommercialBranch_deletedAt_idx" ON "public"."CommercialBranch"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommercialStaff_userId_branchId_key" ON "public"."CommercialStaff"("userId", "branchId");
CREATE INDEX IF NOT EXISTS "CommercialStaff_userId_idx" ON "public"."CommercialStaff"("userId");
CREATE INDEX IF NOT EXISTS "CommercialStaff_branchId_idx" ON "public"."CommercialStaff"("branchId");
CREATE INDEX IF NOT EXISTS "CommercialStaff_status_idx" ON "public"."CommercialStaff"("status");
CREATE INDEX IF NOT EXISTS "CommercialStaff_deletedAt_idx" ON "public"."CommercialStaff"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CommercialAccess_staffId_permission_key" ON "public"."CommercialAccess"("staffId", "permission");
CREATE INDEX IF NOT EXISTS "CommercialAccess_staffId_idx" ON "public"."CommercialAccess"("staffId");
CREATE INDEX IF NOT EXISTS "CommercialAccess_grantedById_idx" ON "public"."CommercialAccess"("grantedById");
CREATE INDEX IF NOT EXISTS "CommercialAccess_permission_idx" ON "public"."CommercialAccess"("permission");
CREATE INDEX IF NOT EXISTS "CommercialAccess_deletedAt_idx" ON "public"."CommercialAccess"("deletedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialEntity_communityId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialEntity"
      ADD CONSTRAINT "CommercialEntity_communityId_fkey"
      FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialEntity_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialEntity"
      ADD CONSTRAINT "CommercialEntity_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialBranch_entityId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialBranch"
      ADD CONSTRAINT "CommercialBranch_entityId_fkey"
      FOREIGN KEY ("entityId") REFERENCES "public"."CommercialEntity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialBranch_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialBranch"
      ADD CONSTRAINT "CommercialBranch_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialStaff_userId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialStaff"
      ADD CONSTRAINT "CommercialStaff_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialStaff_branchId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialStaff"
      ADD CONSTRAINT "CommercialStaff_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "public"."CommercialBranch"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialAccess_staffId_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialAccess"
      ADD CONSTRAINT "CommercialAccess_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "public"."CommercialStaff"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommercialAccess_grantedById_fkey'
  ) THEN
    ALTER TABLE "public"."CommercialAccess"
      ADD CONSTRAINT "CommercialAccess_grantedById_fkey"
      FOREIGN KEY ("grantedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
