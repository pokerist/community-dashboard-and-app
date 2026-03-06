-- CreateEnum
CREATE TYPE "CommercialEntityMemberRole" AS ENUM ('OWNER', 'HR', 'MANAGER');

-- AlterEnum
BEGIN;
UPDATE "CompoundStaff"
SET "status" = 'INACTIVE'
WHERE "status"::text = 'TERMINATED';
CREATE TYPE "CompoundStaffStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
ALTER TABLE "CompoundStaff" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CompoundStaff" ALTER COLUMN "status" TYPE "CompoundStaffStatus_new" USING ("status"::text::"CompoundStaffStatus_new");
ALTER TYPE "CompoundStaffStatus" RENAME TO "CompoundStaffStatus_old";
ALTER TYPE "CompoundStaffStatus_new" RENAME TO "CompoundStaffStatus";
DROP TYPE "CompoundStaffStatus_old";
ALTER TABLE "CompoundStaff" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "CompoundStaff" DROP CONSTRAINT "CompoundStaff_userId_fkey";

-- AlterTable
ALTER TABLE "CommercialEntity" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CompoundStaff" ADD COLUMN     "commercialEntityId" TEXT,
ADD COLUMN     "communityId" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoFileId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

UPDATE "CompoundStaff" AS cs
SET
  "fullName" = COALESCE(u."nameEN", u."nameAR", 'Legacy Staff ' || LEFT(cs."id", 8)),
  "phone" = COALESCE(NULLIF(u."phone", ''), '0000000000'),
  "nationalId" = COALESCE(NULLIF(cs."nationalId", ''), 'LEGACY-' || REPLACE(cs."id", '-', ''))
FROM "User" AS u
WHERE cs."userId" = u."id";

UPDATE "CompoundStaff"
SET
  "fullName" = COALESCE("fullName", 'Legacy Staff ' || LEFT("id", 8)),
  "phone" = COALESCE(NULLIF("phone", ''), '0000000000'),
  "nationalId" = COALESCE(NULLIF("nationalId", ''), 'LEGACY-' || REPLACE("id", '-', ''))
WHERE "fullName" IS NULL
   OR "phone" IS NULL
   OR "nationalId" IS NULL;

ALTER TABLE "CompoundStaff" ALTER COLUMN "fullName" SET NOT NULL;
ALTER TABLE "CompoundStaff" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "CompoundStaff" ALTER COLUMN "nationalId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "clusterId" TEXT;

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialEntityMember" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommercialEntityMemberRole" NOT NULL,
    "status" "MemberStatusEnum" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CommercialEntityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundStaffSchedule" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" "BlueCollarWeekDay" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompoundStaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundStaffGateAccess" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "directions" "GateDirection"[] DEFAULT ARRAY['ENTRY', 'EXIT']::"GateDirection"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompoundStaffGateAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompoundStaffActivityLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompoundStaffActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cluster_communityId_displayOrder_idx" ON "Cluster"("communityId", "displayOrder");

-- CreateIndex
CREATE INDEX "Cluster_isActive_idx" ON "Cluster"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Cluster_communityId_name_key" ON "Cluster"("communityId", "name");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_entityId_idx" ON "CommercialEntityMember"("entityId");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_userId_idx" ON "CommercialEntityMember"("userId");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_role_idx" ON "CommercialEntityMember"("role");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_status_idx" ON "CommercialEntityMember"("status");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_isActive_idx" ON "CommercialEntityMember"("isActive");

-- CreateIndex
CREATE INDEX "CommercialEntityMember_deletedAt_idx" ON "CommercialEntityMember"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialEntityMember_entityId_userId_key" ON "CommercialEntityMember"("entityId", "userId");

-- CreateIndex
CREATE INDEX "CompoundStaffSchedule_staffId_idx" ON "CompoundStaffSchedule"("staffId");

-- CreateIndex
CREATE INDEX "CompoundStaffSchedule_isActive_idx" ON "CompoundStaffSchedule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStaffSchedule_staffId_dayOfWeek_key" ON "CompoundStaffSchedule"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "CompoundStaffGateAccess_staffId_idx" ON "CompoundStaffGateAccess"("staffId");

-- CreateIndex
CREATE INDEX "CompoundStaffGateAccess_gateId_idx" ON "CompoundStaffGateAccess"("gateId");

-- CreateIndex
CREATE INDEX "CompoundStaffGateAccess_isActive_idx" ON "CompoundStaffGateAccess"("isActive");

-- CreateIndex
CREATE INDEX "CompoundStaffGateAccess_grantedById_idx" ON "CompoundStaffGateAccess"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStaffGateAccess_staffId_gateId_key" ON "CompoundStaffGateAccess"("staffId", "gateId");

-- CreateIndex
CREATE INDEX "CompoundStaffActivityLog_staffId_idx" ON "CompoundStaffActivityLog"("staffId");

-- CreateIndex
CREATE INDEX "CompoundStaffActivityLog_actorUserId_idx" ON "CompoundStaffActivityLog"("actorUserId");

-- CreateIndex
CREATE INDEX "CompoundStaffActivityLog_createdAt_idx" ON "CompoundStaffActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "CommercialEntity_isActive_idx" ON "CommercialEntity"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStaff_photoFileId_key" ON "CompoundStaff"("photoFileId");

-- CreateIndex
CREATE INDEX "CompoundStaff_communityId_idx" ON "CompoundStaff"("communityId");

-- CreateIndex
CREATE INDEX "CompoundStaff_commercialEntityId_idx" ON "CompoundStaff"("commercialEntityId");

-- CreateIndex
CREATE INDEX "CompoundStaff_profession_idx" ON "CompoundStaff"("profession");

-- CreateIndex
CREATE INDEX "CompoundStaff_contractTo_idx" ON "CompoundStaff"("contractTo");

-- CreateIndex
CREATE INDEX "CompoundStaff_isActive_idx" ON "CompoundStaff"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundStaff_communityId_nationalId_key" ON "CompoundStaff"("communityId", "nationalId");

-- CreateIndex
CREATE INDEX "Unit_clusterId_idx" ON "Unit"("clusterId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialEntityMember" ADD CONSTRAINT "CommercialEntityMember_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "CommercialEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialEntityMember" ADD CONSTRAINT "CommercialEntityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaff" ADD CONSTRAINT "CompoundStaff_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaff" ADD CONSTRAINT "CompoundStaff_commercialEntityId_fkey" FOREIGN KEY ("commercialEntityId") REFERENCES "CommercialEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaff" ADD CONSTRAINT "CompoundStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaff" ADD CONSTRAINT "CompoundStaff_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffSchedule" ADD CONSTRAINT "CompoundStaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CompoundStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffGateAccess" ADD CONSTRAINT "CompoundStaffGateAccess_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CompoundStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffGateAccess" ADD CONSTRAINT "CompoundStaffGateAccess_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffGateAccess" ADD CONSTRAINT "CompoundStaffGateAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffActivityLog" ADD CONSTRAINT "CompoundStaffActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CompoundStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaffActivityLog" ADD CONSTRAINT "CompoundStaffActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

