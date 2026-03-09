-- Align CommunityUpdate table with current Prisma model that uses `caption`
ALTER TABLE "public"."CommunityUpdate"
ADD COLUMN IF NOT EXISTS "caption" TEXT;

UPDATE "public"."CommunityUpdate"
SET "caption" = COALESCE("caption", "title", "body", '')
WHERE "caption" IS NULL;

ALTER TABLE "public"."CommunityUpdate"
ALTER COLUMN "caption" SET NOT NULL;

-- Keep legacy column for backward compatibility, but make it optional so inserts don't fail.
ALTER TABLE "public"."CommunityUpdate"
ALTER COLUMN "title" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "CommunityUpdate_createdAt_idx"
ON "public"."CommunityUpdate"("createdAt");
