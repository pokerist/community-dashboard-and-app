-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "incidentId" TEXT;

-- CreateTable
CREATE TABLE "IncidentSequence" (
    "name" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "IncidentSequence_pkey" PRIMARY KEY ("name")
);

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
