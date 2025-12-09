/*
  Warnings:

  - Changed the type of `type` on the `Invoice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('RENT', 'SERVICE_FEE', 'UTILITY', 'FINE', 'MAINTENANCE_FEE', 'BOOKING_FEE', 'SETUP_FEE', 'LATE_FEE', 'MISCELLANEOUS', 'OWNER_EXPENSE', 'MANAGEMENT_FEE', 'CREDIT_MEMO', 'DEBIT_MEMO');

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "type",
ADD COLUMN     "type" "InvoiceType" NOT NULL;
