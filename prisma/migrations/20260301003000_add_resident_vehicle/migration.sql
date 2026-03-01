CREATE TABLE "ResidentVehicle" (
  "id" TEXT NOT NULL,
  "residentId" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "plateNumberNormalized" TEXT NOT NULL,
  "color" TEXT,
  "notes" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResidentVehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResidentVehicle_residentId_plateNumberNormalized_key"
ON "ResidentVehicle"("residentId", "plateNumberNormalized");

CREATE INDEX "ResidentVehicle_residentId_createdAt_idx"
ON "ResidentVehicle"("residentId", "createdAt");

ALTER TABLE "ResidentVehicle"
ADD CONSTRAINT "ResidentVehicle_residentId_fkey"
FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
