-- CreateEnum
CREATE TYPE "RentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "Channel" ADD VALUE 'WHATSAPP';

-- AlterEnum
ALTER TYPE "UnitStatus" ADD VALUE 'RENTED';

-- AlterTable
ALTER TABLE "DiscoverPlace" DROP COLUMN "distanceHint";

-- AlterTable
ALTER TABLE "ResidentVehicle" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLanguage" TEXT;

-- CreateTable
CREATE TABLE "RentRequest" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "RentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "tenantName" TEXT NOT NULL,
    "tenantEmail" TEXT NOT NULL,
    "tenantPhone" TEXT NOT NULL,
    "tenantNationalId" TEXT,
    "tenantNationality" "NationalityType" NOT NULL DEFAULT 'EGYPTIAN',
    "tenantNationalIdFileId" TEXT,
    "contractFileId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "approvedLeaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentRequest_ownerUserId_status_createdAt_idx" ON "RentRequest"("ownerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RentRequest_unitId_status_createdAt_idx" ON "RentRequest"("unitId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RentRequest_tenantEmail_status_idx" ON "RentRequest"("tenantEmail", "status");

-- CreateIndex
CREATE INDEX "RentRequest_reviewedById_reviewedAt_idx" ON "RentRequest"("reviewedById", "reviewedAt");

-- AddForeignKey
ALTER TABLE "RentRequest" ADD CONSTRAINT "RentRequest_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRequest" ADD CONSTRAINT "RentRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRequest" ADD CONSTRAINT "RentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRequest" ADD CONSTRAINT "RentRequest_contractFileId_fkey" FOREIGN KEY ("contractFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentRequest" ADD CONSTRAINT "RentRequest_tenantNationalIdFileId_fkey" FOREIGN KEY ("tenantNationalIdFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
