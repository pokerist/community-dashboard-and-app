ALTER TABLE "public"."BlueCollarSetting"
  ADD COLUMN IF NOT EXISTS "workingHoursStart" TEXT NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS "workingHoursEnd" TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS "allowedDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "termsVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "public"."AccessProfile"
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "public"."BlueCollarHoliday" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlueCollarHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BlueCollarHoliday_communityId_date_key"
  ON "public"."BlueCollarHoliday"("communityId", "date");

CREATE INDEX IF NOT EXISTS "BlueCollarHoliday_communityId_date_idx"
  ON "public"."BlueCollarHoliday"("communityId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlueCollarHoliday_communityId_fkey'
  ) THEN
    ALTER TABLE "public"."BlueCollarHoliday"
      ADD CONSTRAINT "BlueCollarHoliday_communityId_fkey"
      FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
