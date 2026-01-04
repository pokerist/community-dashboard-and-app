-- Add `active` to Facility
ALTER TABLE "Facility" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- Add optional rejectionReason to Booking
ALTER TABLE "Booking" ADD COLUMN "rejectionReason" TEXT;