-- CreateEnum
CREATE TYPE "LeaseSource" AS ENUM ('OWNER', 'COMPOUND');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UnitStatus" ADD VALUE 'HELD';
ALTER TYPE "UnitStatus" ADD VALUE 'UNRELEASED';

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "source" "LeaseSource" NOT NULL DEFAULT 'OWNER';

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMember_residentId_idx" ON "FamilyMember"("residentId");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
