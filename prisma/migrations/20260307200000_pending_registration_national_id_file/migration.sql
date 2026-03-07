-- Add nationalIdFileId column to PendingRegistration
ALTER TABLE "public"."PendingRegistration"
  ADD COLUMN IF NOT EXISTS "nationalIdFileId" TEXT;

-- Add foreign key constraint if File table exists and constraint doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PendingRegistration_nationalIdFileId_fkey'
  ) THEN
    ALTER TABLE "public"."PendingRegistration"
      ADD CONSTRAINT "PendingRegistration_nationalIdFileId_fkey"
      FOREIGN KEY ("nationalIdFileId")
      REFERENCES "public"."File"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
