-- AlterTable
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "requiresOnboarding" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingStep" TEXT;

-- AlterTable
ALTER TABLE "FamilyAccessRequest"
  ADD COLUMN IF NOT EXISTS "preRegisteredById" TEXT,
  ADD COLUMN IF NOT EXISTS "isPreRegistration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HomeStaffAccess"
  ADD COLUMN IF NOT EXISTS "preRegisteredById" TEXT,
  ADD COLUMN IF NOT EXISTS "isPreRegistration" BOOLEAN NOT NULL DEFAULT false;

-- Optional indexes for admin queue filters
CREATE INDEX IF NOT EXISTS "FamilyAccessRequest_isPreRegistration_idx"
  ON "FamilyAccessRequest"("isPreRegistration");

CREATE INDEX IF NOT EXISTS "HomeStaffAccess_isPreRegistration_idx"
  ON "HomeStaffAccess"("isPreRegistration");
