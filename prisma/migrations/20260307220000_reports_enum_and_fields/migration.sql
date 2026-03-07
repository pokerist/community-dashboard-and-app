-- Add missing ReportType enum values
ALTER TYPE "public"."ReportType" ADD VALUE IF NOT EXISTS 'COMPLAINTS';
ALTER TYPE "public"."ReportType" ADD VALUE IF NOT EXISTS 'VIOLATIONS';
ALTER TYPE "public"."ReportType" ADD VALUE IF NOT EXISTS 'GATE_ENTRY_LOG';
ALTER TYPE "public"."ReportType" ADD VALUE IF NOT EXISTS 'RESIDENT_ACTIVITY';

-- Add missing ReportFormat enum values
ALTER TYPE "public"."ReportFormat" ADD VALUE IF NOT EXISTS 'XLSX';
ALTER TYPE "public"."ReportFormat" ADD VALUE IF NOT EXISTS 'PDF';

-- Add recipientEmails column to ReportSchedule (was missing from initial migration)
ALTER TABLE "public"."ReportSchedule"
  ADD COLUMN IF NOT EXISTS "recipientEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
