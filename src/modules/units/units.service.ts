import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { Prisma, UnitType, UnitStatus } from '@prisma/client';
import { paginate } from '../../common/utils/pagination.util';
import { UnitStatusChangedEvent } from '../../events/contracts/unit-status-changed.event';

@Injectable()
export class UnitsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async resolveResidentId(
    tx: Prisma.TransactionClient,
    idOrUserId: string,
  ): Promise<string> {
    const byResidentId = await tx.resident.findUnique({
      where: { id: idOrUserId },
      select: { id: true },
    });
    if (byResidentId) return byResidentId.id;

    const byUserId = await tx.resident.findUnique({
      where: { userId: idOrUserId },
      select: { id: true },
    });
    if (byUserId) return byUserId.id;

    throw new NotFoundException('Resident not found');
  }

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

  async findMyUnits(
    actorUserId: string,
    query: UnitQueryDto,
    context?: { permissions?: string[]; roles?: string[] },
  ) {
    const permissions = Array.isArray(context?.permissions)
      ? context!.permissions!
      : [];
    const canViewAll = permissions.includes('unit.view_all');
    if (canViewAll) {
      return this.findAll(query);
    }

    const { type, status, block, projectName, ...baseQuery } = query;

    const where: Prisma.UnitWhereInput = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(block ? { block } : {}),
      ...(projectName ? { projectName } : {}),
      OR: [
        {
          unitAccesses: {
            some: {
              userId: actorUserId,
              status: 'ACTIVE',
            },
          },
        },
        {
          residents: {
            some: {
              resident: {
                userId: actorUserId,
              },
            },
          },
        },
      ],
    };

    return paginate(this.prisma.unit, baseQuery, {
      searchFields: ['unitNumber', 'projectName', 'block'],
      where,
      include: {
        unitAccesses: {
          where: { userId: actorUserId, status: 'ACTIVE' },
          select: {
            id: true,
            role: true,
            status: true,
            startsAt: true,
            endsAt: true,
            canBookFacilities: true,
            canGenerateQR: true,
            canManageWorkers: true,
            canViewFinancials: true,
            canReceiveBilling: true,
          },
        },
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
    userIdOrResidentId: string,
    role: 'OWNER' | 'TENANT' | 'FAMILY',
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Check if unit exists
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit) throw new NotFoundException('Unit not found');

      const residentId = await this.resolveResidentId(tx, userIdOrResidentId);

      // Check if resident is already assigned to this unit
      const existingAssignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (existingAssignment) {
        throw new BadRequestException(
          'Resident is already assigned to this unit',
        );
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

  async removeUser(unitId: string, userIdOrResidentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const residentId = await this.resolveResidentId(tx, userIdOrResidentId);

      // Check if assignment exists
      const assignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (!assignment) {
        throw new NotFoundException(
          'Resident assignment not found for this unit',
        );
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

    // Set isDelivered flag based on status
    // Explicitly check for 'DELIVERED' status to set isDelivered to true
    const isDelivered = status === UnitStatus.DELIVERED;

    const updatedUnit = await this.prisma.unit.update({
      where: { id: unitId },
      data: { status, isDelivered },
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
    if (units.length === 0)
      throw new NotFoundException('No units found matching the number');
    return units;
  }

  // Feature access gating based on unit status
  async canAccessFeature(unitId: string, feature: string): Promise<boolean> {
    return this.prisma.unit
      .findUnique({
        where: { id: unitId },
      })
      .then((unit) => {
        if (!unit) return false;

        switch (feature) {
          case 'add_tenant':
          case 'add_family':
            return unit.status === 'DELIVERED';
          case 'manage_delegates':
            return (
              unit.status === 'DELIVERED' ||
              unit.status === 'OCCUPIED' ||
              unit.status === 'LEASED'
            );
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
