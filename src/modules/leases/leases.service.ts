import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import { LeaseStatus, UnitStatus } from '@prisma/client';

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  // #1. CREATE LEASE
  async create(dto: CreateLeaseDto) {
    // 1. VALIDATION: Check Unit Availability
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { leases: true }, // Include leases to check overlaps
    });

    if (!unit) throw new NotFoundException('Unit not found');

    // Business Rule: Can only lease if Unit is AVAILABLE or OCCUPIED (by owner)
    // If it is ALREADY LEASED, block it.
    if (unit.status === UnitStatus.LEASED) {
      throw new ConflictException('Unit is already LEASED.');
    }
    if (
      unit.status === UnitStatus.UNDER_MAINTENANCE ||
      unit.status === UnitStatus.UNDER_CONSTRUCTION
    ) {
      throw new BadRequestException(
        'Unit is under maintenance/construction and cannot be leased.',
      );
    }

    // 2. VALIDATION: Check for Overlapping Active Leases
    // (Double safety in case status was manually changed)
    const overlappingLease = await this.prisma.lease.findFirst({
      where: {
        unitId: dto.unitId,
        status: LeaseStatus.ACTIVE,
        OR: [
          // Check if new start date falls inside an existing lease
          {
            startDate: { lte: dto.startDate },
            endDate: { gte: dto.startDate },
          },
          // Check if new end date falls inside an existing lease
          {
            startDate: { lte: dto.endDate },
            endDate: { gte: dto.endDate },
          },
          // Check if new lease completely engulfs an existing lease
          {
            startDate: { gte: dto.startDate },
            endDate: { lte: dto.endDate },
          },
        ],
      },
    });

    if (overlappingLease) {
      throw new ConflictException(
        `Unit has an overlapping ACTIVE lease (ID: ${overlappingLease.id}) during this period.`,
      );
    }

    // 3. EXECUTION: Transactional Creation
    return this.prisma.$transaction(async (tx) => {
      // 3.1. Create the Lease
      const lease = await tx.lease.create({
        data: {
          ...dto,
          status: LeaseStatus.ACTIVE,
        },
      });

      // 3.2. Update the Unit Status to LEASED
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.LEASED },
      });

      // 3.3. Grant App Access (Create ResidentUnit record)
      if (dto.tenantId) {
        // Check if they are already assigned to avoid duplicates
        const existingAssignment = await tx.residentUnit.findUnique({
          where: {
            userId_unitId: {
              userId: dto.tenantId,
              unitId: dto.unitId,
            },
          },
        });

        if (!existingAssignment) {
          await tx.residentUnit.create({
            data: {
              userId: dto.tenantId,
              unitId: dto.unitId,
              isPrimary: true, // Assuming lease holder is primary
              assignedAt: new Date(),
            },
          });
        }
      }

      return lease;
    });
  }

  // #2. LIST ALL LEASES
  async findAll() {
    return this.prisma.lease.findMany({
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        tenant: { select: { nameEN: true, email: true, phone: true } },
        owner: { select: { nameEN: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // #3. GET LEASE INFO
  async findOne(id: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        unit: true,
        tenant: true,
        owner: true,
        contractFile: true,
      },
    });

    if (!lease) throw new NotFoundException(`Lease with ID ${id} not found`);
    return lease;
  }
  // #4. LEASE FOR A SPECIFIC UNIT
  async findByUnit(unitId: string) {
    return this.prisma.lease.findMany({
      where: { unitId },
      include: {
        tenant: { select: { nameEN: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // #5. UPDATE LEASE
  async update(id: string, dto: UpdateLeaseDto) {
    const existingLease = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Lease
      const updatedLease = await tx.lease.update({
        where: { id },
        data: dto,
      });

      // 2. Handle Termination/Expiration
      if (
        dto.status === LeaseStatus.TERMINATED ||
        dto.status === LeaseStatus.EXPIRED
      ) {
        // Revert Unit Status
        await tx.unit.update({
          where: { id: existingLease.unitId },
          data: { status: UnitStatus.OCCUPIED },
        });

        // NEW: Revoke App Access (Delete ResidentUnit record)
        if (existingLease.tenantId) {
          await tx.residentUnit.deleteMany({
            where: {
              userId: existingLease.tenantId,
              unitId: existingLease.unitId,
            },
          });
        }

        // TODO: Call AccessService to revoke QR codes
      }

      return updatedLease;
    });
  }

  async remove(id: string) {
    // Retrieve lease details before deletion to get the unitId
    const existingLease = await this.findOne(id);

    // --- PRODUCTION FIX: TRANSACTION REQUIRED ---
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete the Lease record
      const result = await tx.lease.delete({
        where: { id },
      });

      // 2. Revert the Unit Status to OCCUPIED
      await tx.unit.update({
        where: { id: existingLease.unitId },
        data: { status: 'OCCUPIED' },
      });

      return result;
    });
    // TODO: Inject AccessService and call accessService.revokeKeysForUnit(unitId)
  }
}
