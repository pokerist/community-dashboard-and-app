-- CreateTable
CREATE TABLE "SystemSetting" (
    "section" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("section")
);

-- CreateTable
CREATE TABLE "SystemSettingsBackupSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,

    CONSTRAINT "SystemSettingsBackupSnapshot_pkey" PRIMARY KEY ("id")
);
