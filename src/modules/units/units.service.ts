import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UnitType, UnitStatus } from '@prisma/client';
import { paginate } from '../../common/utils/pagination.util';
import { UnitStatusChangedEvent } from '../../events/contracts/unit-status-changed.event';

@Injectable()
export class UnitsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // CRUD
  async findAll(query: UnitQueryDto) {
    const { type, status, block, projectName, ...baseQuery } = query;

    const filters: Record<string, any> = {
      type,
      status,
      block,
      projectName,
    };

    return paginate(this.prisma.unit, baseQuery, {
      searchFields: ['unitNumber', 'projectName', 'block'],
      additionalFilters: filters,
      include: {
        residents: {
          include: { resident: true },
        },
        leases: true,
      },
    });
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
    return this.prisma.$transaction(async (tx) => {
      // Check if unit exists
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit) throw new NotFoundException('Unit not found');

      // Check if resident exists
      const resident = await tx.resident.findUnique({ where: { id: residentId } });
      if (!resident) throw new NotFoundException('Resident not found');

      // Check if resident is already assigned to this unit
      const existingAssignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (existingAssignment) {
        throw new BadRequestException('Resident is already assigned to this unit');
      }

      // If assigning as OWNER, check if unit already has an owner
      if (role === 'OWNER') {
        const existingOwner = await tx.residentUnit.findFirst({
          where: { unitId, isPrimary: true },
        });
        if (existingOwner) {
          throw new BadRequestException('Unit already has an owner assigned');
        }
      }

      return tx.residentUnit.create({
        data: {
          unitId,
          residentId,
          isPrimary: role === 'OWNER',
        },
      });
    });
  }

  async removeUser(unitId: string, residentId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if assignment exists
      const assignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (!assignment) {
        throw new NotFoundException('Resident assignment not found for this unit');
      }

      return tx.residentUnit.delete({
        where: { residentId_unitId: { residentId, unitId } },
      });
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
    const unit = await this.findOne(unitId);
    const previousStatus = unit.status;

    const updatedUnit = await this.prisma.unit.update({
      where: { id: unitId },
      data: { status },
    });

    // Emit event if status changed
    if (previousStatus !== status) {
      this.eventEmitter.emit(
        'unit.status.changed',
        new UnitStatusChangedEvent(
          unitId,
          unit.unitNumber,
          previousStatus,
          status,
          unit.projectName,
        ),
      );
    }

    return updatedUnit;
  }

  // Lease info
  async getLeases(unitId: string) {
    return this.prisma.lease.findMany({ where: { unitId } });
  }

  // By number - supports partial search
  async getByNumber(unitNumber: string) {
    const units = await this.prisma.unit.findMany({
      where: {
        unitNumber: {
          contains: unitNumber,
          mode: 'insensitive',
        },
      },
    });
    if (units.length === 0) throw new NotFoundException('No units found matching the number');
    return units;
  }

  // Feature access gating based on unit status
  async canAccessFeature(unitId: string, feature: string): Promise<boolean> {
    return this.prisma.unit.findUnique({
      where: { id: unitId },
    }).then(unit => {
      if (!unit) return false;

      switch (feature) {
        case 'add_tenant':
        case 'add_family':
        case 'manage_delegates':
          return unit.status === 'DELIVERED';
        case 'view_payment_plan':
        case 'view_announcements':
        case 'view_overdue_checks':
          return true; // Available even for NOT_DELIVERED
        default:
          return false;
      }
    });
  }

  // Get user access level for a unit
  async getUserAccessForUnit(unitId: string, userId: string) {
    const access = await this.prisma.unitAccess.findFirst({
      where: {
        unitId,
        userId,
        status: 'ACTIVE',
      },
    });

    return access;
  }
}
