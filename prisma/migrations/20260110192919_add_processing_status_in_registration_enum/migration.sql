-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "PendingRegistration" ADD COLUMN     "roleIntent" TEXT;
