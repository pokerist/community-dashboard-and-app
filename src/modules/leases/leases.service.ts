import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path to your PrismaService
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeaseDto) {
    return this.prisma.lease.create({
      data: {
        ...dto,
        // Prisma expects Decimal for money, simple numbers work fine here 
        // but explicit casting ensures safety if needed.
        monthlyRent: dto.monthlyRent, 
        securityDeposit: dto.securityDeposit,
      },
    });
  }

  async findAll() {
    return this.prisma.lease.findMany({
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        tenant: { select: { name: true, email: true, phone: true } },
        owner: { select: { name: true } },
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
        tenant: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async update(id: string, dto: UpdateLeaseDto) {
    // Check existence first
    await this.findOne(id);

    return this.prisma.lease.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    // Check existence
    await this.findOne(id);

    return this.prisma.lease.delete({
      where: { id },
    });
  }
}