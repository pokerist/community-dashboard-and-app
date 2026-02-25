-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "NotificationDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDeviceToken_token_key" ON "NotificationDeviceToken"("token");

-- CreateIndex
CREATE INDEX "NotificationDeviceToken_userId_isActive_idx" ON "NotificationDeviceToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "NotificationDeviceToken_platform_isActive_idx" ON "NotificationDeviceToken"("platform", "isActive");

-- CreateIndex
CREATE INDEX "NotificationDeviceToken_updatedAt_idx" ON "NotificationDeviceToken"("updatedAt");

-- AddForeignKey
ALTER TABLE "NotificationDeviceToken" ADD CONSTRAINT "NotificationDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
