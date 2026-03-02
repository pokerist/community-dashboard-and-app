-- CreateEnum
CREATE TYPE "QrUsageMode" AS ENUM ('SINGLE_USE', 'MULTI_USE');

-- AlterTable
ALTER TABLE "AccessQRCode"
ADD COLUMN "usageMode" "QrUsageMode" NOT NULL DEFAULT 'SINGLE_USE';

-- AlterTable
ALTER TABLE "FamilyAccessRequest"
ADD COLUMN "featurePermissions" JSONB;
