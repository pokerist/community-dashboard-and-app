/*
  Warnings:

  - The values [CONFIRMED,COMPLETED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bookingNumber` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `guests` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `purpose` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `rejectionReason` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `timeEnd` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `timeStart` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `Facility` table. All the data in the column will be lost.
  - You are about to drop the column `closeTime` on the `Facility` table. All the data in the column will be lost.
  - You are about to drop the column `openTime` on the `Facility` table. All the data in the column will be lost.
  - The `type` column on the `Facility` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `userId` on the `ResidentUnit` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[residentId,unitId]` on the table `ResidentUnit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `endTime` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Facility` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('GYM', 'POOL', 'TENNIS_COURT', 'MULTIPURPOSE_HALL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('NONE', 'PER_HOUR', 'PER_SLOT', 'PER_USE');

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED', 'REJECTED');
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_residentId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_unitId_fkey";

-- DropForeignKey
ALTER TABLE "ResidentUnit" DROP CONSTRAINT "ResidentUnit_userId_fkey";

-- DropIndex
DROP INDEX "Booking_bookingNumber_key";

-- DropIndex
DROP INDEX "ResidentUnit_userId_idx";

-- DropIndex
DROP INDEX "ResidentUnit_userId_isPrimary_idx";

-- DropIndex
DROP INDEX "ResidentUnit_userId_unitId_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "bookingNumber",
DROP COLUMN "guests",
DROP COLUMN "purpose",
DROP COLUMN "rejectionReason",
DROP COLUMN "timeEnd",
DROP COLUMN "timeStart",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "residentId" DROP NOT NULL,
ALTER COLUMN "unitId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Facility" DROP COLUMN "active",
DROP COLUMN "closeTime",
DROP COLUMN "openTime",
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "cooldownMinutes" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxReservationsPerDay" INTEGER,
ADD COLUMN     "price" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "FacilityType" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "ResidentUnit" DROP COLUMN "userId",
ADD COLUMN     "residentId" TEXT;

-- CreateTable
CREATE TABLE "FacilitySlotConfig" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL,
    "slotCapacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySlotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilitySlotException" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "slotDurationMinutes" INTEGER,
    "slotCapacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySlotException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidentUnit_residentId_idx" ON "ResidentUnit"("residentId");

-- CreateIndex
CREATE INDEX "ResidentUnit_residentId_isPrimary_idx" ON "ResidentUnit"("residentId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentUnit_residentId_unitId_key" ON "ResidentUnit"("residentId", "unitId");

-- AddForeignKey
ALTER TABLE "ResidentUnit" ADD CONSTRAINT "ResidentUnit_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitySlotConfig" ADD CONSTRAINT "FacilitySlotConfig_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitySlotException" ADD CONSTRAINT "FacilitySlotException_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
