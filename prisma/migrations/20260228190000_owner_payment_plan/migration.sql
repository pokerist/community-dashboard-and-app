-- CreateEnum
CREATE TYPE "OwnerPaymentMode" AS ENUM ('CASH', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "OwnerInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "OwnerUnitContract" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "contractFileId" TEXT,
    "contractSignedAt" TIMESTAMP(3),
    "paymentMode" "OwnerPaymentMode" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerUnitContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerInstallment" (
    "id" TEXT NOT NULL,
    "ownerUnitContractId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "referenceFileId" TEXT,
    "referencePageIndex" INTEGER,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "OwnerInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerUnitContract_ownerUserId_unitId_key" ON "OwnerUnitContract"("ownerUserId", "unitId");

-- CreateIndex
CREATE INDEX "OwnerUnitContract_unitId_idx" ON "OwnerUnitContract"("unitId");

-- CreateIndex
CREATE INDEX "OwnerUnitContract_paymentMode_idx" ON "OwnerUnitContract"("paymentMode");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerInstallment_ownerUnitContractId_sequence_key" ON "OwnerInstallment"("ownerUnitContractId", "sequence");

-- CreateIndex
CREATE INDEX "OwnerInstallment_dueDate_status_idx" ON "OwnerInstallment"("dueDate", "status");

-- AddForeignKey
ALTER TABLE "OwnerUnitContract" ADD CONSTRAINT "OwnerUnitContract_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerUnitContract" ADD CONSTRAINT "OwnerUnitContract_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerUnitContract" ADD CONSTRAINT "OwnerUnitContract_contractFileId_fkey" FOREIGN KEY ("contractFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerUnitContract" ADD CONSTRAINT "OwnerUnitContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerInstallment" ADD CONSTRAINT "OwnerInstallment_ownerUnitContractId_fkey" FOREIGN KEY ("ownerUnitContractId") REFERENCES "OwnerUnitContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerInstallment" ADD CONSTRAINT "OwnerInstallment_referenceFileId_fkey" FOREIGN KEY ("referenceFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

