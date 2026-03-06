CREATE TABLE IF NOT EXISTS "public"."InvoiceCategory" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "mappedType" "public"."InvoiceType" NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceCategory_label_key"
  ON "public"."InvoiceCategory"("label");
