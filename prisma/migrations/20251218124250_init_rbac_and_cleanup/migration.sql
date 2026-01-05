/*
  Warnings:

  - The `status` column on the `Banner` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Incident` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `NotificationLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `PendingRegistration` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Referral` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `ServiceRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `SmartDevice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `dateOfBirth` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `nationalId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `phoneVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - The `source` column on the `UserStatusLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('SENT', 'FAILED', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "SmartDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BannerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserStatusLogSource" AS ENUM ('SIGNUP_AUTO', 'ADMIN', 'MANUAL');

-- DropIndex
DROP INDEX "User_nationalId_key";

-- AlterTable
ALTER TABLE "Banner" DROP COLUMN "status",
ADD COLUMN     "status" "BannerStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "status",
ADD COLUMN     "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "NotificationLog" DROP COLUMN "status",
ADD COLUMN     "status" "NotificationLogStatus" NOT NULL DEFAULT 'SENT';

-- AlterTable
ALTER TABLE "PendingRegistration" DROP COLUMN "status",
ADD COLUMN     "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Referral" DROP COLUMN "status",
ADD COLUMN     "status" "ReferralStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "ServiceRequest" DROP COLUMN "status",
ADD COLUMN     "status" "ServiceRequestStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "SmartDevice" DROP COLUMN "status",
ADD COLUMN     "status" "SmartDeviceStatus" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "dateOfBirth",
DROP COLUMN "nationalId",
DROP COLUMN "origin",
DROP COLUMN "phoneVerified",
DROP COLUMN "role",
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerificationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerificationToken" TEXT,
ADD COLUMN     "phoneVerificationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "signupSource" TEXT NOT NULL DEFAULT 'dashboard',
ALTER COLUMN "userStatus" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "UserStatusLog" DROP COLUMN "source",
ADD COLUMN     "source" "UserStatusLogSource";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "UserStatusEnum" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nationalId" TEXT,
    "dateOfBirth" TIMESTAMP(3),

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Resident_userId_key" ON "Resident"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_userId_key" ON "Owner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_userId_key" ON "Tenant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "ResidentUnit_userId_isPrimary_idx" ON "ResidentUnit"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
