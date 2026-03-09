-- AlterTable
ALTER TABLE "PermitType" ADD COLUMN "iconName" TEXT,
ADD COLUMN "color" TEXT;

-- CreateTable
CREATE TABLE "MicroService" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MicroService_serviceId_idx" ON "MicroService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "MicroService_serviceId_name_key" ON "MicroService"("serviceId", "name");

-- AddForeignKey
ALTER TABLE "MicroService" ADD CONSTRAINT "MicroService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
