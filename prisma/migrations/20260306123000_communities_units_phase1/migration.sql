-- CreateEnum
CREATE TYPE "GateRole" AS ENUM ('RESIDENT', 'VISITOR', 'WORKER', 'DELIVERY', 'STAFF', 'RIDESHARE');

-- CreateEnum
CREATE TYPE "EntryRole" AS ENUM ('RESIDENT_OWNER', 'RESIDENT_FAMILY', 'RESIDENT_TENANT', 'VISITOR', 'WORKER', 'STAFF');

-- CreateEnum
CREATE TYPE "GateAccessMode" AS ENUM ('ALL_GATES', 'SELECTED_GATES');

-- AlterTable
ALTER TABLE "Cluster" ADD COLUMN     "code" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "allowedEntryRoles" "EntryRole"[] DEFAULT ARRAY[]::"EntryRole"[];

-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "allowedRoles",
ADD COLUMN     "allowedRoles" "GateRole"[] DEFAULT ARRAY['VISITOR']::"GateRole"[],
ALTER COLUMN "etaMinutes" DROP NOT NULL,
ALTER COLUMN "etaMinutes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "allowedGateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gateAccessMode" "GateAccessMode" NOT NULL DEFAULT 'ALL_GATES';

-- CreateIndex
CREATE INDEX "Cluster_communityId_idx" ON "Cluster"("communityId");

-- CreateIndex
CREATE INDEX "Cluster_deletedAt_idx" ON "Cluster"("deletedAt");

-- CreateIndex
CREATE INDEX "Gate_communityId_isActive_idx" ON "Gate"("communityId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_communityId_name_key" ON "Gate"("communityId", "name");
