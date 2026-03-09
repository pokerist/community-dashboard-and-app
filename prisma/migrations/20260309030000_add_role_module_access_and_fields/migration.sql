-- AlterTable
ALTER TABLE "Role" ADD COLUMN "description" TEXT;
ALTER TABLE "Role" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoleModuleAccess" (
    "roleId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "canAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoleModuleAccess_pkey" PRIMARY KEY ("roleId","moduleKey")
);

-- CreateIndex
CREATE INDEX "RoleModuleAccess_roleId_idx" ON "RoleModuleAccess"("roleId");

-- AddForeignKey
ALTER TABLE "RoleModuleAccess" ADD CONSTRAINT "RoleModuleAccess_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
