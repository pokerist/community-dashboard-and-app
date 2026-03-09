-- DropIndex
DROP INDEX "FamilyAccessRequest_isPreRegistration_idx";

-- DropIndex
DROP INDEX "HomeStaffAccess_isPreRegistration_idx";

-- AlterTable
ALTER TABLE "CompoundStaff" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GateCluster" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GateCluster_gateId_idx" ON "GateCluster"("gateId");

-- CreateIndex
CREATE INDEX "GateCluster_clusterId_idx" ON "GateCluster"("clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "GateCluster_gateId_clusterId_key" ON "GateCluster"("gateId", "clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "AttendanceLog_staffId_clockInAt_idx" ON "AttendanceLog"("staffId", "clockInAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_clockInAt_idx" ON "AttendanceLog"("clockInAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_recordedById_idx" ON "AttendanceLog"("recordedById");

-- AddForeignKey
ALTER TABLE "GateCluster" ADD CONSTRAINT "GateCluster_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateCluster" ADD CONSTRAINT "GateCluster_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompoundStaff" ADD CONSTRAINT "CompoundStaff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "CompoundStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
