-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CommunityPhase'
  ) THEN
    CREATE TYPE "CommunityPhase" AS ENUM (
      'PLANNING',
      'UNDER_CONSTRUCTION',
      'PARTIALLY_DELIVERED',
      'FULLY_DELIVERED'
    );
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "Community"
ADD COLUMN IF NOT EXISTS "phase" "CommunityPhase" NOT NULL DEFAULT 'PLANNING',
ADD COLUMN IF NOT EXISTS "guidelines" TEXT;
