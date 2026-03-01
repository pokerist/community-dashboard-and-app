import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class FacilitiesService {
  constructor(private prisma: PrismaService) {}

  private isSuperAdminRole(roles: unknown): boolean {
    return (
      Array.isArray(roles) &&
      roles.some(
        (r) => typeof r === 'string' && r.toUpperCase() === 'SUPER_ADMIN',
      )
    );
  }

  private canViewAllFacilities(ctx: { permissions: string[]; roles: string[] }) {
    return (
      this.isSuperAdminRole(ctx.roles) ||
      (Array.isArray(ctx.permissions) &&
        ctx.permissions.includes('facility.view_all'))
    );
  }

  async create(dto: CreateFacilityDto) {
    return this.prisma.$transaction(async (prisma) => {
      return await prisma.facility.create({
        data: {
          name: dto.name,
          description: dto.description,
          type: dto.type,
          isActive: dto.isActive ?? true,
          capacity: dto.capacity,
          price: dto.price,
          billingCycle: dto.billingCycle,
          isBookable: dto.isBookable ?? true,
          requiresPrepayment: dto.requiresPrepayment ?? false,
          reminderMinutesBefore: dto.reminderMinutesBefore ?? 60,
          maxReservationsPerDay: dto.maxReservationsPerDay,
          cooldownMinutes: dto.cooldownMinutes,

          slotConfig: dto.slotConfig
            ? {
                create: dto.slotConfig.map((slot) => ({
                  dayOfWeek: slot.dayOfWeek,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  slotDurationMinutes: slot.slotDurationMinutes,
                  slotCapacity: slot.slotCapacity,
                })),
              }
            : undefined,

          slotExceptions: dto.slotExceptions
            ? {
                create: dto.slotExceptions.map((exc) => ({
                  date: new Date(exc.date),
                  isClosed: exc.isClosed ?? false,
                  startTime: exc.startTime,
                  endTime: exc.endTime,
                  slotDurationMinutes: exc.slotDurationMinutes,
                  slotCapacity: exc.slotCapacity,
                })),
              }
            : undefined,
        },
        include: {
          slotConfig: true,
          slotExceptions: true,
        },
      });
    });
  }

  async findAll() {
    return this.prisma.facility.findMany({
      include: {
        slotConfig: true,
        slotExceptions: true,
      },
    });
  }

  async findAllForActor(ctx: {
    actorUserId: string;
    permissions: string[];
    roles: string[];
  }) {
    const canViewAll = this.canViewAllFacilities(ctx);
    if (canViewAll) return this.findAll();

    return this.prisma.facility.findMany({
      where: { isActive: true },
      include: {
        slotConfig: true,
        slotExceptions: true,
      },
    });
  }

  async findOne(id: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        slotConfig: true,
        slotExceptions: true,
      },
    });

    if (!facility) throw new NotFoundException('Facility not found');

    return facility;
  }

  async findOneForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    const facility = await this.findOne(id);

    const canViewAll = this.canViewAllFacilities(ctx);
    if (canViewAll) return facility;

    if (!facility.isActive) {
      throw new NotFoundException('Facility not found');
    }

    return facility;
  }

  async update(id: string, dto: UpdateFacilityDto) {
    await this.findOne(id);

    // Destructure nested relations from dto
    const { slotConfig, slotExceptions, ...updateData } = dto;

    return this.prisma.$transaction(async (prisma) => {
      // Update the facility itself
      await prisma.facility.update({
        where: { id },
        data: updateData,
      });

      // Handle slotConfig updates (MVP approach: delete all and recreate)
      // TODO: Add unique constraints on (facilityId, dayOfWeek) to use upsert and preserve IDs
      if (slotConfig !== undefined) {
        await prisma.facilitySlotConfig.deleteMany({
          where: { facilityId: id },
        });
        if (slotConfig.length > 0) {
          await prisma.facilitySlotConfig.createMany({
            data: slotConfig.map((slot) => ({
              facilityId: id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              slotDurationMinutes: slot.slotDurationMinutes,
              slotCapacity: slot.slotCapacity,
            })),
          });
        }
      }

      // Handle slotExceptions updates (MVP approach: delete all and recreate)
      // TODO: Add unique constraints on (facilityId, date) to use upsert and preserve IDs
      if (slotExceptions !== undefined) {
        await prisma.facilitySlotException.deleteMany({
          where: { facilityId: id },
        });
        if (slotExceptions.length > 0) {
          await prisma.facilitySlotException.createMany({
            data: slotExceptions.map((exc) => ({
              facilityId: id,
              date: new Date(exc.date),
              isClosed: exc.isClosed ?? false,
              startTime: exc.startTime,
              endTime: exc.endTime,
              slotDurationMinutes: exc.slotDurationMinutes,
              slotCapacity: exc.slotCapacity,
            })),
          });
        }
      }

      // Return the updated facility with includes
      return prisma.facility.findUnique({
        where: { id },
        include: {
          slotConfig: true,
          slotExceptions: true,
        },
      });
    });
  }

  async remove(id: string) {
    const facility = await this.findOne(id);

    // Check for active bookings
    const activeBookings = await this.prisma.booking.count({
      where: {
        facilityId: id,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.APPROVED,
          ],
        },
      },
    });

    if (activeBookings > 0) {
      throw new BadRequestException(
        `Cannot delete facility with ${activeBookings} active booking(s). Cancel all bookings first.`,
      );
    }

    // Soft delete: set isActive to false instead of hard delete
    return this.prisma.facility.update({
      where: { id },
      data: { isActive: false },
      include: {
        slotConfig: true,
        slotExceptions: true,
      },
    });
  }
}
