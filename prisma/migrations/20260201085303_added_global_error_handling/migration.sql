/*
  Warnings:

  - You are about to drop the column `oldStatus` on the `UserStatusLog` table. All the data in the column will be lost.
  - The `newStatus` column on the `UserStatusLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "UserStatusEnum" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "UserStatusLog" DROP COLUMN "oldStatus",
DROP COLUMN "newStatus",
ADD COLUMN     "newStatus" "UserStatusEnum" NOT NULL DEFAULT 'ACTIVE';
