/*
  Warnings:

  - The `displayPriority` column on the `Banner` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `priority` column on the `Complaint` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `priority` column on the `Incident` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `priority` column on the `ServiceRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "Banner" DROP COLUMN "displayPriority",
ADD COLUMN     "displayPriority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "Complaint" DROP COLUMN "priority",
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "priority",
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "ServiceRequest" DROP COLUMN "priority",
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'MEDIUM';

-- DropEnum
DROP TYPE "IncidentPriority";
