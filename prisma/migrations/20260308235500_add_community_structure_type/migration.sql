-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CommunityStructure'
  ) THEN
    CREATE TYPE "CommunityStructure" AS ENUM ('CLUSTERS', 'PHASES');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "public"."Community"
ADD COLUMN IF NOT EXISTS "structureType" "CommunityStructure";

UPDATE "public"."Community"
SET "structureType" = 'CLUSTERS'
WHERE "structureType" IS NULL;

ALTER TABLE "public"."Community"
ALTER COLUMN "structureType" SET DEFAULT 'CLUSTERS',
ALTER COLUMN "structureType" SET NOT NULL;
