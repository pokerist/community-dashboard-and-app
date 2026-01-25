/*
  Warnings:

  - The values [UNDER_MAINTENANCE,UNDER_CONSTRUCTION] on the enum `UnitStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `gate` on the `AccessQRCode` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nationalIdFileId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entity` to the `Attachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityId` to the `Attachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('PROFILE_PHOTO', 'NATIONAL_ID', 'CONTRACT', 'DELEGATE_ID', 'WORKER_ID', 'DELIVERY', 'SERVICE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "ContractorRoleEnum" AS ENUM ('ADMIN', 'SUPERVISOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "MemberStatusEnum" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UnitAccessRole" AS ENUM ('OWNER', 'TENANT', 'FAMILY', 'DELEGATE');

-- CreateEnum
CREATE TYPE "DelegateType" AS ENUM ('FAMILY', 'FRIEND', 'INTERIOR_DESIGNER');

-- CreateEnum
CREATE TYPE "AccessGrantPermission" AS ENUM ('ENTER', 'WORK', 'DELIVER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessStatus" ADD VALUE 'PENDING';
ALTER TYPE "AccessStatus" ADD VALUE 'APPROVED';
ALTER TYPE "AccessStatus" ADD VALUE 'REVOKED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'OTP';

-- AlterEnum
BEGIN;
CREATE TYPE "UnitStatus_new" AS ENUM ('AVAILABLE', 'NOT_DELIVERED', 'DELIVERED', 'OCCUPIED', 'LEASED');
ALTER TABLE "Unit" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Unit" ALTER COLUMN "status" TYPE "UnitStatus_new" USING ("status"::text::"UnitStatus_new");
ALTER TYPE "UnitStatus" RENAME TO "UnitStatus_old";
ALTER TYPE "UnitStatus_new" RENAME TO "UnitStatus";
DROP TYPE "UnitStatus_old";
ALTER TABLE "Unit" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- DropForeignKey
ALTER TABLE "ResidentUnit" DROP CONSTRAINT "ResidentUnit_residentId_fkey";

-- AlterTable
ALTER TABLE "AccessQRCode" DROP COLUMN "gate",
ADD COLUMN     "accessGrantId" TEXT,
ADD COLUMN     "gates" TEXT[];

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "entity" TEXT NOT NULL,
ADD COLUMN     "entityId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "category" "FileCategory" NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "serviceRequestId" TEXT,
ADD COLUMN     "violationId" TEXT;

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "relationship" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "isDelivered" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nationalIdFileId" TEXT;

-- CreateTable
CREATE TABLE "UnitAccess" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UnitAccessRole" NOT NULL,
    "delegateType" "DelegateType",
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "grantedBy" TEXT NOT NULL,
    "status" "AccessStatus" NOT NULL,
    "source" TEXT,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canReceiveBilling" BOOLEAN NOT NULL DEFAULT false,
    "canBookFacilities" BOOLEAN NOT NULL DEFAULT true,
    "canGenerateQR" BOOLEAN NOT NULL DEFAULT false,
    "canManageWorkers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessProfile" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "phone" TEXT,
    "photoId" TEXT,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorMember" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ContractorRoleEnum" NOT NULL,
    "status" "MemberStatusEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "accessProfileId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "jobType" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "accessProfileId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "permissions" "AccessGrantPermission"[],

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubhouseAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubhouseAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalIdFileId_key" ON "User"("nationalIdFileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_nationalIdFileId_fkey" FOREIGN KEY ("nationalIdFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentUnit" ADD CONSTRAINT "ResidentUnit_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAccess" ADD CONSTRAINT "UnitAccess_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAccess" ADD CONSTRAINT "UnitAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMember" ADD CONSTRAINT "ContractorMember_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorMember" ADD CONSTRAINT "ContractorMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "AccessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_accessProfileId_fkey" FOREIGN KEY ("accessProfileId") REFERENCES "AccessProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_violationId_fkey" FOREIGN KEY ("violationId") REFERENCES "Violation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubhouseAccessRequest" ADD CONSTRAINT "ClubhouseAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubhouseAccessRequest" ADD CONSTRAINT "ClubhouseAccessRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
