ALTER TABLE "public"."InvoiceCategory"
ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."InvoiceCategory"
SET "isSystem" = true
WHERE "isSystem" = false;
