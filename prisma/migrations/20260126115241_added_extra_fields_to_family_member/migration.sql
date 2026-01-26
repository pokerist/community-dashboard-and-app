/*
  Warnings:

  - You are about to drop the column `residentId` on the `FamilyMember` table. All the data in the column will be lost.
  - The `status` column on the `FamilyMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[familyResidentId]` on the table `FamilyMember` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "FamilyMember" DROP CONSTRAINT "FamilyMember_residentId_fkey";

-- DropIndex
DROP INDEX "FamilyMember_residentId_idx";

-- AlterTable
ALTER TABLE "FamilyMember" DROP COLUMN "residentId",
ADD COLUMN     "familyResidentId" TEXT,
ADD COLUMN     "primaryResidentId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "UserStatusEnum" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyResidentId_key" ON "FamilyMember"("familyResidentId");

-- CreateIndex
CREATE INDEX "FamilyMember_primaryResidentId_idx" ON "FamilyMember"("primaryResidentId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyResidentId_idx" ON "FamilyMember"("familyResidentId");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_primaryResidentId_fkey" FOREIGN KEY ("primaryResidentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyResidentId_fkey" FOREIGN KEY ("familyResidentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
