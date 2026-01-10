/*
  Warnings:

  - Added the required column `nationalId` to the `PendingRegistration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `personalPhotoId` to the `PendingRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PendingRegistration" ADD COLUMN     "nationalId" TEXT NOT NULL,
ADD COLUMN     "personalPhotoId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "PendingRegistration" ADD CONSTRAINT "PendingRegistration_personalPhotoId_fkey" FOREIGN KEY ("personalPhotoId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
