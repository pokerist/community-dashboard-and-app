-- Add icon metadata for service/request catalog cards
ALTER TABLE "Service"
  ADD COLUMN "iconName" TEXT,
  ADD COLUMN "iconTone" TEXT NOT NULL DEFAULT 'auto';
