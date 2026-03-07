-- Survey and food ordering module tables.

DO $$ BEGIN
  CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SurveyTarget" AS ENUM ('ALL', 'SPECIFIC_COMMUNITIES', 'SPECIFIC_UNITS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SurveyFieldType" AS ENUM ('TEXT', 'MULTIPLE_CHOICE', 'RATING', 'YES_NO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Survey" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetType" "SurveyTarget" NOT NULL DEFAULT 'ALL',
  "targetMeta" JSONB,
  "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "notificationId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyQuestion" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "type" "SurveyFieldType" NOT NULL,
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyResponse" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SurveyAnswer" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" INTEGER,
  "valueChoice" TEXT,
  CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Restaurant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "logoFileId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10,2) NOT NULL,
  "photoFileId" TEXT,
  "category" TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unitId" TEXT,
  "restaurantId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "notes" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "preparedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT,
  "messageEn" TEXT NOT NULL,
  "messageAr" TEXT,
  "channels" "Channel"[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderSequence" (
  "name" TEXT NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("name")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyResponse_surveyId_userId_key" ON "SurveyResponse"("surveyId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_name_key" ON "NotificationTemplate"("name");

CREATE INDEX IF NOT EXISTS "Survey_status_createdAt_idx" ON "Survey"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Survey_createdById_createdAt_idx" ON "Survey"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "SurveyQuestion_surveyId_displayOrder_idx" ON "SurveyQuestion"("surveyId", "displayOrder");
CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_submittedAt_idx" ON "SurveyResponse"("surveyId", "submittedAt");
CREATE INDEX IF NOT EXISTS "SurveyAnswer_responseId_idx" ON "SurveyAnswer"("responseId");
CREATE INDEX IF NOT EXISTS "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "Restaurant_isActive_displayOrder_idx" ON "Restaurant"("isActive", "displayOrder");
CREATE INDEX IF NOT EXISTS "Restaurant_category_idx" ON "Restaurant"("category");
CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_category_displayOrder_idx" ON "MenuItem"("restaurantId", "category", "displayOrder");
CREATE INDEX IF NOT EXISTS "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");
CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_createdAt_idx" ON "Order"("restaurantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_unitId_createdAt_idx" ON "Order"("unitId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

DO $$ BEGIN
  ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyQuestion"
    ADD CONSTRAINT "SurveyQuestion_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyAnswer"
    ADD CONSTRAINT "SurveyAnswer_responseId_fkey"
    FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SurveyAnswer"
    ADD CONSTRAINT "SurveyAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MenuItem"
    ADD CONSTRAINT "MenuItem_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
