/*
  Warnings:

  - Changed the type of `type` on the `ResidentDocument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ResidentDocument" DROP COLUMN "type",
ADD COLUMN     "type" "FileCategory" NOT NULL;

-- DropEnum
DROP TYPE "ResidentDocumentType";

-- CreateIndex
CREATE UNIQUE INDEX "ResidentDocument_residentId_type_key" ON "ResidentDocument"("residentId", "type");
