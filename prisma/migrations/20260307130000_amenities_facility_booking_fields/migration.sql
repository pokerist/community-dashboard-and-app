-- AlterTable: Facility
ALTER TABLE "Facility"
    ADD COLUMN IF NOT EXISTS "iconName" TEXT,
    ADD COLUMN IF NOT EXISTS "color" TEXT,
    ADD COLUMN IF NOT EXISTS "rules" TEXT;

-- AlterTable: Booking
ALTER TABLE "Booking"
    ADD COLUMN IF NOT EXISTS "cancelledById" TEXT,
    ADD COLUMN IF NOT EXISTS "rejectedById" TEXT,
    ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
    ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
    ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2);
