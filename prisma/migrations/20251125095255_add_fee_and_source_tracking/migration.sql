-- CreateTable
CREATE TABLE "UnitFee" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingMonth" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitFee_invoiceId_key" ON "UnitFee"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitFee_unitId_type_billingMonth_key" ON "UnitFee"("unitId", "type", "billingMonth");

-- AddForeignKey
ALTER TABLE "UnitFee" ADD CONSTRAINT "UnitFee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitFee" ADD CONSTRAINT "UnitFee_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
