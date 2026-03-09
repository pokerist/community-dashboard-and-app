-- Backfill drifted databases where Unit.category was not created.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'UnitCategory'
  ) THEN
    CREATE TYPE "UnitCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');
  END IF;
END $$;

ALTER TABLE "Unit"
ADD COLUMN IF NOT EXISTS "category" "UnitCategory";

UPDATE "Unit"
SET "category" = 'COMMERCIAL'
WHERE "category" IS NULL
  AND "type"::text IN ('ADMINISTRATIVE', 'COMMERCIAL_UNIT');

UPDATE "Unit"
SET "category" = 'RESIDENTIAL'
WHERE "category" IS NULL;

ALTER TABLE "Unit"
ALTER COLUMN "category" SET DEFAULT 'RESIDENTIAL';

ALTER TABLE "Unit"
ALTER COLUMN "category" SET NOT NULL;
