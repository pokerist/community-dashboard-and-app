-- Add REQUESTS as a distinct service category for mobile/app request templates.
ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'REQUESTS';

