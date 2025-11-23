import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path to your PrismaService
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import { LeaseStatus } from '@prisma/client';

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

async create(dto: CreateLeaseDto) {
  // --- PRODUCTION FIX: TRANSACTION REQUIRED ---
  return this.prisma.$transaction(async (tx) => {
    // 1. Create the Lease, setting status to ACTIVE
    const lease = await tx.lease.create({
      data: {
        ...dto,
        monthlyRent: dto.monthlyRent,
        securityDeposit: dto.securityDeposit,
        status: LeaseStatus.ACTIVE, // Assuming newly created lease starts as ACTIVE
      },
    });

    // 2. Update the Unit Status to LEASED
    await tx.unit.update({
      where: { id: dto.unitId },
      data: { status: 'LEASED' },
    });

    return lease;
  });
}

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

  async findByUnit(unitId: string) {
    return this.prisma.lease.findMany({
      where: { unitId },
      include: {
        tenant: { select: { nameEN: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

async update(id: string, dto: UpdateLeaseDto) {
  // Check existence first
  await this.findOne(id);

  // --- PRODUCTION FIX: TRANSACTION REQUIRED ---
  return this.prisma.$transaction(async (tx) => {
    // 1. Update the Lease record
    const updatedLease = await tx.lease.update({
      where: { id },
      data: dto,
    });

    // 2. Check if the lease status changed to a terminating state
    if (dto.status && (dto.status === 'TERMINATED' || dto.status === 'EXPIRED')) {
      // If the lease is terminated/expired, revert the unit status to OCCUPIED
      await tx.unit.update({
        where: { id: updatedLease.unitId },
        data: { status: 'OCCUPIED' },
      });
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
}
}