-- Normalize legacy UnitStatus values and align enum to the current schema.
-- Legacy -> current mapping:
-- NOT_DELIVERED -> UNDER_CONSTRUCTION
-- AVAILABLE/OCCUPIED/LEASED/HELD/UNRELEASED/RENTED -> DELIVERED

ALTER TYPE "UnitStatus" ADD VALUE IF NOT EXISTS 'OFF_PLAN';
ALTER TYPE "UnitStatus" ADD VALUE IF NOT EXISTS 'UNDER_CONSTRUCTION';

UPDATE "Unit"
SET "status" = 'UNDER_CONSTRUCTION'
WHERE "status"::text = 'NOT_DELIVERED';

UPDATE "Unit"
SET "status" = 'DELIVERED'
WHERE "status"::text IN ('AVAILABLE', 'OCCUPIED', 'LEASED', 'HELD', 'UNRELEASED', 'RENTED');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'RoleStatusPermission'
  ) THEN
    EXECUTE 'UPDATE "RoleStatusPermission" SET "unitStatus" = ''UNDER_CONSTRUCTION'' WHERE "unitStatus"::text = ''NOT_DELIVERED''';
    EXECUTE 'UPDATE "RoleStatusPermission" SET "unitStatus" = ''DELIVERED'' WHERE "unitStatus"::text IN (''AVAILABLE'', ''OCCUPIED'', ''LEASED'', ''HELD'', ''UNRELEASED'', ''RENTED'')';
  END IF;
END $$;

BEGIN;

ALTER TABLE "Unit" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "UnitStatus_new" AS ENUM ('OFF_PLAN', 'UNDER_CONSTRUCTION', 'DELIVERED');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'RoleStatusPermission'
  ) THEN
    EXECUTE 'ALTER TABLE "RoleStatusPermission" ALTER COLUMN "unitStatus" TYPE "UnitStatus_new" USING ("unitStatus"::text::"UnitStatus_new")';
  END IF;
END $$;

ALTER TABLE "Unit"
ALTER COLUMN "status" TYPE "UnitStatus_new" USING ("status"::text::"UnitStatus_new");

ALTER TYPE "UnitStatus" RENAME TO "UnitStatus_old";
ALTER TYPE "UnitStatus_new" RENAME TO "UnitStatus";
DROP TYPE "UnitStatus_old";

ALTER TABLE "Unit" ALTER COLUMN "status" SET DEFAULT 'OFF_PLAN';

COMMIT;
