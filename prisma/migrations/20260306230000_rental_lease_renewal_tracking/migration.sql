ALTER TABLE "public"."Lease"
  ADD COLUMN IF NOT EXISTS "renewedFromId" TEXT,
  ADD COLUMN IF NOT EXISTS "renewedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "renewalNoticeSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lease_renewedFromId_idx" ON "public"."Lease"("renewedFromId");
CREATE INDEX IF NOT EXISTS "Lease_renewedToId_idx" ON "public"."Lease"("renewedToId");
