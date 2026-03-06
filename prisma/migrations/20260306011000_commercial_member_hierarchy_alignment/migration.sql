-- Commercial module hierarchy alignment
-- Target: CommercialOwner -> CommercialHR -> CommercialStaff

-- 1) Extend tables first (nullable additions to allow backfill)
ALTER TABLE "CommercialEntity" ADD COLUMN "unitId" TEXT;
ALTER TABLE "CommercialEntityMember" ADD COLUMN "createdById" TEXT;
ALTER TABLE "CommercialEntityMember" ADD COLUMN "permissions" JSONB;

-- 2) Backfill CommercialEntity.unitId from existing branches
UPDATE "CommercialEntity" ce
SET "unitId" = mapped."unitId"
FROM (
  SELECT DISTINCT ON (b."entityId") b."entityId", b."unitId"
  FROM "CommercialBranch" b
  WHERE b."unitId" IS NOT NULL
    AND b."deletedAt" IS NULL
  ORDER BY b."entityId", b."createdAt" ASC
) AS mapped
WHERE ce."id" = mapped."entityId"
  AND ce."unitId" IS NULL;

-- Fallback: if an entity had no branch unit, pick first active unit in same community.
UPDATE "CommercialEntity" ce
SET "unitId" = u."id"
FROM (
  SELECT DISTINCT ON (u."communityId") u."communityId", u."id"
  FROM "Unit" u
  WHERE u."deletedAt" IS NULL
    AND u."isActive" = true
  ORDER BY u."communityId", u."createdAt" ASC
) AS u
WHERE ce."communityId" = u."communityId"
  AND ce."unitId" IS NULL;

-- Final fallback: pick the first active unit globally to avoid blocking migration.
UPDATE "CommercialEntity" ce
SET "unitId" = u."id"
FROM (
  SELECT u."id"
  FROM "Unit" u
  WHERE u."deletedAt" IS NULL
    AND u."isActive" = true
  ORDER BY u."createdAt" ASC
  LIMIT 1
) AS u
WHERE ce."unitId" IS NULL;

-- 3) Backfill owner/HR/manager into new member hierarchy
INSERT INTO "CommercialEntityMember" (
  "id",
  "entityId",
  "userId",
  "role",
  "permissions",
  "isActive",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  'cem-' || md5(ce."id" || ':' || ce."ownerUserId" || ':owner'),
  ce."id",
  ce."ownerUserId",
  'OWNER'::"CommercialEntityMemberRole",
  jsonb_build_object(
    'can_work_orders', true,
    'can_attendance', true,
    'can_service_requests', true,
    'can_tickets', true,
    'can_photo_upload', true,
    'can_task_reminders', true
  ),
  true,
  ce."createdAt",
  ce."updatedAt",
  NULL
FROM "CommercialEntity" ce
WHERE ce."ownerUserId" IS NOT NULL
ON CONFLICT ("entityId", "userId") DO UPDATE
SET
  "role" = 'OWNER'::"CommercialEntityMemberRole",
  "permissions" = EXCLUDED."permissions",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP,
  "deletedAt" = NULL;

-- Convert legacy MANAGER members to HR role before enum shrink.
UPDATE "CommercialEntityMember"
SET "role" = 'HR'
WHERE "role"::text = 'MANAGER';

-- Ensure OWNER and HR members have full management permission flags.
UPDATE "CommercialEntityMember"
SET "permissions" = jsonb_build_object(
  'can_work_orders', true,
  'can_attendance', true,
  'can_service_requests', true,
  'can_tickets', true,
  'can_photo_upload', true,
  'can_task_reminders', true
)
WHERE "role" IN ('OWNER', 'HR');

-- 4) Migrate CommercialStaff + CommercialAccess into CommercialEntityMember(STAFF)
WITH staff_agg AS (
  SELECT
    b."entityId" AS "entityId",
    cs."userId" AS "userId",
    bool_or(ca."permission" = 'WORK_ORDERS' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_work_orders,
    bool_or(ca."permission" = 'ATTENDANCE' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_attendance,
    bool_or(ca."permission" = 'SERVICE_REQUESTS' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_service_requests,
    bool_or(ca."permission" = 'TICKET_HANDLING' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_tickets,
    bool_or(ca."permission" = 'PHOTO_UPLOAD' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_photo_upload,
    bool_or(ca."permission" = 'TASK_REMINDERS' AND ca."isGranted" = true AND ca."deletedAt" IS NULL) AS can_task_reminders,
    bool_or(cs."status" = 'ACTIVE' AND cs."deletedAt" IS NULL) AS is_active
  FROM "CommercialStaff" cs
  INNER JOIN "CommercialBranch" b ON b."id" = cs."branchId"
  LEFT JOIN "CommercialAccess" ca ON ca."staffId" = cs."id"
  GROUP BY b."entityId", cs."userId"
)
INSERT INTO "CommercialEntityMember" (
  "id",
  "entityId",
  "userId",
  "role",
  "permissions",
  "isActive",
  "createdAt",
  "updatedAt",
  "deletedAt"
)
SELECT
  'cem-' || md5(sa."entityId" || ':' || sa."userId" || ':staff'),
  sa."entityId",
  sa."userId",
  'MANAGER'::"CommercialEntityMemberRole",
  jsonb_build_object(
    'can_work_orders', COALESCE(sa.can_work_orders, false),
    'can_attendance', COALESCE(sa.can_attendance, false),
    'can_service_requests', COALESCE(sa.can_service_requests, false),
    'can_tickets', COALESCE(sa.can_tickets, false),
    'can_photo_upload', COALESCE(sa.can_photo_upload, false),
    'can_task_reminders', COALESCE(sa.can_task_reminders, false)
  ),
  COALESCE(sa.is_active, false),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CASE WHEN COALESCE(sa.is_active, false) THEN NULL ELSE CURRENT_TIMESTAMP END
FROM staff_agg sa
ON CONFLICT ("entityId", "userId") DO UPDATE
SET
  "permissions" = COALESCE("CommercialEntityMember"."permissions", '{}'::jsonb) || EXCLUDED."permissions",
  "isActive" = "CommercialEntityMember"."isActive" OR EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP,
  "deletedAt" = CASE
    WHEN ("CommercialEntityMember"."isActive" OR EXCLUDED."isActive") THEN NULL
    ELSE "CommercialEntityMember"."deletedAt"
  END;

-- 5) Replace enum to OWNER/HR/STAFF only
BEGIN;
CREATE TYPE "CommercialEntityMemberRole_new" AS ENUM ('OWNER', 'HR', 'STAFF');
ALTER TABLE "CommercialEntityMember"
  ALTER COLUMN "role" TYPE "CommercialEntityMemberRole_new"
  USING (
    CASE
      WHEN "role"::text = 'MANAGER' THEN 'STAFF'
      ELSE "role"::text
    END::"CommercialEntityMemberRole_new"
  );
ALTER TYPE "CommercialEntityMemberRole" RENAME TO "CommercialEntityMemberRole_old";
ALTER TYPE "CommercialEntityMemberRole_new" RENAME TO "CommercialEntityMemberRole";
DROP TYPE "CommercialEntityMemberRole_old";
COMMIT;

-- 6) Remove legacy foreign keys before dropping columns/tables
ALTER TABLE "CommercialAccess" DROP CONSTRAINT "CommercialAccess_grantedById_fkey";
ALTER TABLE "CommercialAccess" DROP CONSTRAINT "CommercialAccess_staffId_fkey";
ALTER TABLE "CommercialBranch" DROP CONSTRAINT "CommercialBranch_entityId_fkey";
ALTER TABLE "CommercialBranch" DROP CONSTRAINT "CommercialBranch_unitId_fkey";
ALTER TABLE "CommercialEntity" DROP CONSTRAINT "CommercialEntity_ownerUserId_fkey";
ALTER TABLE "CommercialStaff" DROP CONSTRAINT "CommercialStaff_branchId_fkey";
ALTER TABLE "CommercialStaff" DROP CONSTRAINT "CommercialStaff_userId_fkey";

-- 7) Remove obsolete indexes
DROP INDEX "CommercialEntity_ownerUserId_idx";
DROP INDEX "CommercialEntity_status_idx";
DROP INDEX "CommercialEntityMember_status_idx";

-- 8) Finalize new required/clean shape
ALTER TABLE "CommercialEntity"
  DROP COLUMN "ownerUserId",
  DROP COLUMN "status";

ALTER TABLE "CommercialEntity"
  ALTER COLUMN "unitId" SET NOT NULL;

ALTER TABLE "CommercialEntityMember"
  DROP COLUMN "status";

-- 9) Drop legacy commercial hierarchy tables/enums
DROP TABLE "CommercialAccess";
DROP TABLE "CommercialStaff";
DROP TABLE "CommercialBranch";
DROP TYPE "CommercialAccessPermission";
DROP TYPE "CommercialStaffRole";

-- 10) Add new indexes/constraints
CREATE UNIQUE INDEX "CommercialEntity_communityId_name_key" ON "CommercialEntity"("communityId", "name");
CREATE INDEX "CommercialEntity_unitId_idx" ON "CommercialEntity"("unitId");
CREATE INDEX "CommercialEntityMember_createdById_idx" ON "CommercialEntityMember"("createdById");

ALTER TABLE "CommercialEntity"
  ADD CONSTRAINT "CommercialEntity_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommercialEntityMember"
  ADD CONSTRAINT "CommercialEntityMember_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
