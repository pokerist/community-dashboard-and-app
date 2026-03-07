CREATE TABLE IF NOT EXISTS "public"."ComplaintCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slaHours" INTEGER NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplaintCategory_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Complaint'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE "public"."Complaint" RENAME COLUMN "category" TO "categoryLegacy";
  END IF;
END $$;

ALTER TABLE "public"."Complaint"
  ALTER COLUMN "categoryLegacy" DROP NOT NULL;

ALTER TABLE "public"."Complaint"
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Complaint_categoryId_fkey'
  ) THEN
    ALTER TABLE "public"."Complaint"
      ADD CONSTRAINT "Complaint_categoryId_fkey"
      FOREIGN KEY ("categoryId")
      REFERENCES "public"."ComplaintCategory"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ComplaintCategory_name_key"
  ON "public"."ComplaintCategory"("name");

CREATE INDEX IF NOT EXISTS "Complaint_categoryId_idx"
  ON "public"."Complaint"("categoryId");

CREATE INDEX IF NOT EXISTS "Complaint_status_slaDeadline_idx"
  ON "public"."Complaint"("status", "slaDeadline");

CREATE INDEX IF NOT EXISTS "Complaint_slaBreachedAt_idx"
  ON "public"."Complaint"("slaBreachedAt");
