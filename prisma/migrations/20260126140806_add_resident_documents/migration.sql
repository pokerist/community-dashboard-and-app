/*
  Warnings:

  - Changed the type of `relationship` on the `FamilyMember` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `familyResidentId` on table `FamilyMember` required. This step will fail if there are existing NULL values in that column.
  - Made the column `primaryResidentId` on table `FamilyMember` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('CHILD', 'SPOUSE', 'PARENT');

-- CreateEnum
CREATE TYPE "ResidentDocumentType" AS ENUM ('MARRIAGE_CERTIFICATE', 'BIRTH_CERTIFICATE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileCategory" ADD VALUE 'MARRIAGE_CERTIFICATE';
ALTER TYPE "FileCategory" ADD VALUE 'BIRTH_CERTIFICATE';

-- DropForeignKey
ALTER TABLE "FamilyMember" DROP CONSTRAINT "FamilyMember_familyResidentId_fkey";

-- DropForeignKey
ALTER TABLE "FamilyMember" DROP CONSTRAINT "FamilyMember_primaryResidentId_fkey";

-- AlterTable
ALTER TABLE "FamilyMember" DROP COLUMN "relationship",
ADD COLUMN     "relationship" "RelationshipType" NOT NULL,
ALTER COLUMN "familyResidentId" SET NOT NULL,
ALTER COLUMN "primaryResidentId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ResidentDocument" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "type" "ResidentDocumentType" NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidentDocument_residentId_idx" ON "ResidentDocument"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentDocument_residentId_type_key" ON "ResidentDocument"("residentId", "type");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_primaryResidentId_fkey" FOREIGN KEY ("primaryResidentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyResidentId_fkey" FOREIGN KEY ("familyResidentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentDocument" ADD CONSTRAINT "ResidentDocument_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentDocument" ADD CONSTRAINT "ResidentDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
