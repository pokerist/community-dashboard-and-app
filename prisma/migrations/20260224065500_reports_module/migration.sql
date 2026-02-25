-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('OCCUPANCY', 'FINANCIAL', 'SERVICE_REQUESTS', 'SECURITY_INCIDENTS', 'VISITOR_TRAFFIC', 'MAINTENANCE_COSTS');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "label" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "params" JSONB,
    "summary" JSONB,
    "rows" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "label" TEXT NOT NULL,
    "params" JSONB,
    "frequency" TEXT NOT NULL,
    "cronExpr" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);
