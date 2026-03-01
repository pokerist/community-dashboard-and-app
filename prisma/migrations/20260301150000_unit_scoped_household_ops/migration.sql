-- Enums
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProfileChangeRequestStatus') THEN
    CREATE TYPE "ProfileChangeRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HouseholdRequestStatus') THEN
    CREATE TYPE "HouseholdRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FamilyRelationType') THEN
    CREATE TYPE "FamilyRelationType" AS ENUM ('SON_DAUGHTER','MOTHER_FATHER','SPOUSE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NationalityType') THEN
    CREATE TYPE "NationalityType" AS ENUM ('EGYPTIAN','FOREIGN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthorizedFeeMode') THEN
    CREATE TYPE "AuthorizedFeeMode" AS ENUM ('NO_FEE','FEE_REQUIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HomeStaffType') THEN
    CREATE TYPE "HomeStaffType" AS ENUM ('DRIVER','NANNY','SERVANT','GARDENER','OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ViolationActionType') THEN
    CREATE TYPE "ViolationActionType" AS ENUM ('APPEAL','FIX_SUBMISSION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ViolationActionStatus') THEN
    CREATE TYPE "ViolationActionStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CLOSED');
  END IF;
END
$$;

-- Existing table alterations
ALTER TABLE "UnitAccess"
  ADD COLUMN IF NOT EXISTS "qrScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "featurePermissions" JSONB;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "isUrgent" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Complaint"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "team" TEXT;

ALTER TABLE "Facility"
  ADD COLUMN IF NOT EXISTS "isBookable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requiresPrepayment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminderMinutesBefore" INTEGER DEFAULT 60;

-- Profile change requests
CREATE TABLE IF NOT EXISTS "ProfileChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ProfileChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedFields" JSONB NOT NULL,
  "previousSnapshot" JSONB,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_userId_status_createdAt_idx" ON "ProfileChangeRequest"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_status_createdAt_idx" ON "ProfileChangeRequest"("status", "createdAt");

ALTER TABLE "ProfileChangeRequest"
  ADD CONSTRAINT "ProfileChangeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileChangeRequest"
  ADD CONSTRAINT "ProfileChangeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Family requests
CREATE TABLE IF NOT EXISTS "FamilyAccessRequest" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" "HouseholdRequestStatus" NOT NULL DEFAULT 'PENDING',
  "relationship" "FamilyRelationType" NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "nationality" "NationalityType" NOT NULL DEFAULT 'EGYPTIAN',
  "nationalIdOrPassport" TEXT,
  "personalPhotoFileId" TEXT NOT NULL,
  "nationalIdFileId" TEXT,
  "passportFileId" TEXT,
  "birthCertificateFileId" TEXT,
  "marriageCertificateFileId" TEXT,
  "childAgeBracket" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "activatedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FamilyAccessRequest_ownerUserId_unitId_status_createdAt_idx" ON "FamilyAccessRequest"("ownerUserId", "unitId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FamilyAccessRequest_status_createdAt_idx" ON "FamilyAccessRequest"("status", "createdAt");

ALTER TABLE "FamilyAccessRequest"
  ADD CONSTRAINT "FamilyAccessRequest_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyAccessRequest"
  ADD CONSTRAINT "FamilyAccessRequest_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyAccessRequest"
  ADD CONSTRAINT "FamilyAccessRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FamilyAccessRequest"
  ADD CONSTRAINT "FamilyAccessRequest_activatedUserId_fkey"
    FOREIGN KEY ("activatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Authorized requests
CREATE TABLE IF NOT EXISTS "AuthorizedAccessRequest" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" "HouseholdRequestStatus" NOT NULL DEFAULT 'PENDING',
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "nationality" "NationalityType" NOT NULL DEFAULT 'EGYPTIAN',
  "nationalIdOrPassport" TEXT,
  "idOrPassportFileId" TEXT NOT NULL,
  "powerOfAttorneyFileId" TEXT NOT NULL,
  "personalPhotoFileId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3) NOT NULL,
  "authorizationStartsAt" TIMESTAMP(3),
  "authorizationEndsAt" TIMESTAMP(3),
  "qrScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "featurePermissions" JSONB,
  "feeMode" "AuthorizedFeeMode" NOT NULL DEFAULT 'NO_FEE',
  "feeAmount" DECIMAL(12,2),
  "activationInvoiceId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "activatedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizedAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuthorizedAccessRequest_ownerUserId_unitId_status_createdAt_idx" ON "AuthorizedAccessRequest"("ownerUserId", "unitId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AuthorizedAccessRequest_status_createdAt_idx" ON "AuthorizedAccessRequest"("status", "createdAt");

ALTER TABLE "AuthorizedAccessRequest"
  ADD CONSTRAINT "AuthorizedAccessRequest_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorizedAccessRequest"
  ADD CONSTRAINT "AuthorizedAccessRequest_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorizedAccessRequest"
  ADD CONSTRAINT "AuthorizedAccessRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizedAccessRequest"
  ADD CONSTRAINT "AuthorizedAccessRequest_activatedUserId_fkey"
    FOREIGN KEY ("activatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizedAccessRequest"
  ADD CONSTRAINT "AuthorizedAccessRequest_activationInvoiceId_fkey"
    FOREIGN KEY ("activationInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Home staff
CREATE TABLE IF NOT EXISTS "HomeStaffAccess" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" "HouseholdRequestStatus" NOT NULL DEFAULT 'PENDING',
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "nationality" "NationalityType" NOT NULL DEFAULT 'EGYPTIAN',
  "nationalIdOrPassport" TEXT,
  "idOrPassportFileId" TEXT NOT NULL,
  "personalPhotoFileId" TEXT,
  "employmentFrom" TIMESTAMP(3),
  "employmentTo" TIMESTAMP(3),
  "isLiveIn" BOOLEAN NOT NULL DEFAULT false,
  "staffType" "HomeStaffType" NOT NULL DEFAULT 'OTHER',
  "accessValidFrom" TIMESTAMP(3) NOT NULL,
  "accessValidTo" TIMESTAMP(3) NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "workerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomeStaffAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomeStaffAccess_ownerUserId_unitId_status_createdAt_idx" ON "HomeStaffAccess"("ownerUserId", "unitId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "HomeStaffAccess_status_createdAt_idx" ON "HomeStaffAccess"("status", "createdAt");

ALTER TABLE "HomeStaffAccess"
  ADD CONSTRAINT "HomeStaffAccess_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeStaffAccess"
  ADD CONSTRAINT "HomeStaffAccess_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeStaffAccess"
  ADD CONSTRAINT "HomeStaffAccess_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HomeStaffAccess"
  ADD CONSTRAINT "HomeStaffAccess_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Violation actions
CREATE TABLE IF NOT EXISTS "ViolationActionRequest" (
  "id" TEXT NOT NULL,
  "violationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "type" "ViolationActionType" NOT NULL,
  "status" "ViolationActionStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "attachmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ViolationActionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ViolationActionRequest_violationId_status_createdAt_idx" ON "ViolationActionRequest"("violationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ViolationActionRequest_requestedById_createdAt_idx" ON "ViolationActionRequest"("requestedById", "createdAt");

ALTER TABLE "ViolationActionRequest"
  ADD CONSTRAINT "ViolationActionRequest_violationId_fkey"
    FOREIGN KEY ("violationId") REFERENCES "Violation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViolationActionRequest"
  ADD CONSTRAINT "ViolationActionRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViolationActionRequest"
  ADD CONSTRAINT "ViolationActionRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Help Center + Discover
CREATE TABLE IF NOT EXISTS "HelpCenterEntry" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "availability" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpCenterEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DiscoverPlace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "address" TEXT,
  "mapLink" TEXT,
  "phone" TEXT,
  "workingHours" TEXT,
  "imageFileId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "distanceHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoverPlace_pkey" PRIMARY KEY ("id")
);
