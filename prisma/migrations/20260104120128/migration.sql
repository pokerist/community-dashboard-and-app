/*
  Warnings:

  - Made the column `residentId` on table `ResidentUnit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ResidentUnit" DROP CONSTRAINT "ResidentUnit_residentId_fkey";

-- AlterTable
ALTER TABLE "ResidentUnit" ALTER COLUMN "residentId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ResidentUnit" ADD CONSTRAINT "ResidentUnit_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
