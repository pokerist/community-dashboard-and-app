import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UnitType, UnitStatus } from '@prisma/client';
import { paginate } from '../../common/utils/pagination.util';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  // CRUD
  async findAll(query: UnitQueryDto) {
    const { type, status, block, projectName, ...baseQuery } = query;

    const filters: Record<string, any> = {
      type,
      status,
      block,
      projectName,
    };

    return paginate(
      this.prisma.unit,
      baseQuery,
      {
        searchFields: ['unitNumber', 'projectName', 'block'],
        additionalFilters: filters,
        include: {
          residents: {
            include: { resident: true },
          },
          leases: true,
        },
      },
    );
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { residents: true, leases: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async create(dto: CreateUnitDto) {
    return this.prisma.unit.create({ data: dto });
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.unit.delete({ where: { id } });
  }

  // Assignment
  async assignUser(
    unitId: string,
    residentId: string,
    role: 'OWNER' | 'TENANT' | 'FAMILY',
  ) {
    return this.prisma.residentUnit.create({
      data: {
        unitId,
        residentId,
        isPrimary: role === 'OWNER',
      },
    });
  }

  async removeUser(unitId: string, residentId: string) {
    return this.prisma.residentUnit.delete({
      where: { residentId_unitId: { residentId, unitId } },
    });
  }

  async getUsers(unitId: string) {
    return this.prisma.residentUnit.findMany({
      where: { unitId },
      include: { resident: true },
    });
  }

  // Status
  async updateStatus(unitId: string, status: UnitStatus) {
    await this.findOne(unitId);
    return this.prisma.unit.update({ where: { id: unitId }, data: { status } });
  }

  // Lease info
  async getLeases(unitId: string) {
    return this.prisma.lease.findMany({ where: { unitId } });
  }

  // By number
  async getByNumber(unitNumber: string) {
    const unit = await this.prisma.unit.findFirst({ where: { unitNumber } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }
}
