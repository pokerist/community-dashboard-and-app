-- Add PENDING_RESIDENT value to ComplaintStatus enum
ALTER TYPE "public"."ComplaintStatus" ADD VALUE IF NOT EXISTS 'PENDING_RESIDENT';
