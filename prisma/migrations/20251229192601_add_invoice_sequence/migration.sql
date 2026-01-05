-- DropIndex
DROP INDEX "UnitFee_invoiceId_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "complaintId" TEXT,
ADD COLUMN     "incidentId" TEXT;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "name" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("name")
);

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
