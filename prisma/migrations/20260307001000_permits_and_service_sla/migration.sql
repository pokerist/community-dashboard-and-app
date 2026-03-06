-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PermitCategory'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PermitCategory" AS ENUM (
      'ACCOUNT_INFO',
      'LEGAL_OWNERSHIP',
      'UTILITIES_SERVICES',
      'COMMUNITY_ACTIVITIES',
      'OPERATIONAL'
    );
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PermitStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PermitStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "public"."Service"
  ADD COLUMN IF NOT EXISTS "slaHours" INTEGER,
  ADD COLUMN IF NOT EXISTS "assignedRoleId" TEXT,
  ADD COLUMN IF NOT EXISTS "revenueTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "public"."ServiceRequest"
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "customerRating" INTEGER,
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ServiceRequest_customerRating_check'
  ) THEN
    ALTER TABLE "public"."ServiceRequest"
      ADD CONSTRAINT "ServiceRequest_customerRating_check"
      CHECK ("customerRating" IS NULL OR ("customerRating" >= 1 AND "customerRating" <= 5));
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."PermitType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" "public"."PermitCategory" NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."PermitField" (
  "id" TEXT NOT NULL,
  "permitTypeId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "public"."ServiceFieldType" NOT NULL,
  "placeholder" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PermitField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."PermitRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "permitTypeId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "public"."PermitStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."PermitRequestFieldValue" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DOUBLE PRECISION,
  "valueBool" BOOLEAN,
  "valueDate" TIMESTAMP(3),
  CONSTRAINT "PermitRequestFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."PermitRequestSequence" (
  "name" TEXT NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "PermitRequestSequence_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PermitType_name_key" ON "public"."PermitType"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "PermitType_slug_key" ON "public"."PermitType"("slug");
CREATE INDEX IF NOT EXISTS "PermitField_permitTypeId_displayOrder_idx" ON "public"."PermitField"("permitTypeId", "displayOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "PermitRequest_requestNumber_key" ON "public"."PermitRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "PermitRequest_permitTypeId_createdAt_idx" ON "public"."PermitRequest"("permitTypeId", "createdAt");
CREATE INDEX IF NOT EXISTS "PermitRequest_status_createdAt_idx" ON "public"."PermitRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PermitRequest_unitId_createdAt_idx" ON "public"."PermitRequest"("unitId", "createdAt");
CREATE INDEX IF NOT EXISTS "PermitRequest_requestedById_createdAt_idx" ON "public"."PermitRequest"("requestedById", "createdAt");
CREATE INDEX IF NOT EXISTS "PermitRequestFieldValue_requestId_idx" ON "public"."PermitRequestFieldValue"("requestId");
CREATE INDEX IF NOT EXISTS "PermitRequestFieldValue_fieldId_idx" ON "public"."PermitRequestFieldValue"("fieldId");
CREATE INDEX IF NOT EXISTS "Service_assignedRoleId_idx" ON "public"."Service"("assignedRoleId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_requestedAt_idx" ON "public"."ServiceRequest"("status", "requestedAt");
CREATE INDEX IF NOT EXISTS "ServiceRequest_assignedToId_requestedAt_idx" ON "public"."ServiceRequest"("assignedToId", "requestedAt");
CREATE INDEX IF NOT EXISTS "ServiceRequest_slaBreachedAt_idx" ON "public"."ServiceRequest"("slaBreachedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Service_assignedRoleId_fkey'
  ) THEN
    ALTER TABLE "public"."Service"
      ADD CONSTRAINT "Service_assignedRoleId_fkey"
      FOREIGN KEY ("assignedRoleId") REFERENCES "public"."Role"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitField_permitTypeId_fkey'
  ) THEN
    ALTER TABLE "public"."PermitField"
      ADD CONSTRAINT "PermitField_permitTypeId_fkey"
      FOREIGN KEY ("permitTypeId") REFERENCES "public"."PermitType"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequest_permitTypeId_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequest"
      ADD CONSTRAINT "PermitRequest_permitTypeId_fkey"
      FOREIGN KEY ("permitTypeId") REFERENCES "public"."PermitType"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequest_unitId_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequest"
      ADD CONSTRAINT "PermitRequest_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "public"."Unit"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequest"
      ADD CONSTRAINT "PermitRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequest"
      ADD CONSTRAINT "PermitRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequestFieldValue_requestId_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequestFieldValue"
      ADD CONSTRAINT "PermitRequestFieldValue_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "public"."PermitRequest"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PermitRequestFieldValue_fieldId_fkey'
  ) THEN
    ALTER TABLE "public"."PermitRequestFieldValue"
      ADD CONSTRAINT "PermitRequestFieldValue_fieldId_fkey"
      FOREIGN KEY ("fieldId") REFERENCES "public"."PermitField"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
