/*
  Warnings:

  - The values [CONTRACTOR] on the enum `QRType` will be removed. If these variants are still used in the database, this will fail.
  - The `userStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `description` on table `ServiceRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserStatusEnum" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FinishingStatus" AS ENUM ('NOT_STARTED', 'UNDER_FINISHING', 'MOVED_IN');

-- AlterEnum
BEGIN;
CREATE TYPE "QRType_new" AS ENUM ('VISITOR', 'DELIVERY', 'WORKER', 'SERVICE_PROVIDER', 'RIDESHARE');
ALTER TABLE "AccessQRCode" ALTER COLUMN "type" TYPE "QRType_new" USING ("type"::text::"QRType_new");
ALTER TYPE "QRType" RENAME TO "QRType_old";
ALTER TYPE "QRType_new" RENAME TO "QRType";
DROP TYPE "QRType_old";
COMMIT;

-- AlterTable
ALTER TABLE "ResidentUnit" ADD COLUMN     "finishingStatus" "FinishingStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "startingPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ServiceRequest" ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "userStatus",
ADD COLUMN     "userStatus" "UserStatusEnum" NOT NULL DEFAULT 'INVITED';

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "mobileNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "friendFullName" TEXT NOT NULL,
    "friendMobile" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_nameEn_key" ON "Project"("nameEn");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
