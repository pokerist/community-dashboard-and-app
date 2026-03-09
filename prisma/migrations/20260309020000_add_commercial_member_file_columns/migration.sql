-- Backfill drifted DBs: commercial member file columns were missing.

ALTER TABLE "CommercialEntityMember"
ADD COLUMN IF NOT EXISTS "photoFileId" TEXT,
ADD COLUMN IF NOT EXISTS "nationalIdFileId" TEXT;
