import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';

@Injectable()
export class FacilitiesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFacilityDto) {
    return await this.prisma.facility.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isActive: dto.isActive ?? true,
        capacity: dto.capacity,
        price: dto.price,
        billingCycle: dto.billingCycle,
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
  }

  async findAll() {
    return this.prisma.facility.findMany({
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
  
async update(id: string, dto: UpdateFacilityDto) {
  await this.findOne(id);

  // Destructure nested relations from dto
  const { slotConfig, slotExceptions, ...updateData } = dto;

  // Build the update data with proper Prisma syntax for relations
  const data: any = {
    ...updateData,
  };

  // Handle slotConfig updates (delete all and recreate)
  if (slotConfig !== undefined) {
    data.slotConfig = {
      deleteMany: {},
      create: slotConfig.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotDurationMinutes: slot.slotDurationMinutes,
        slotCapacity: slot.slotCapacity,
      })),
    };
  }

  // Handle slotExceptions updates (delete all and recreate)
  if (slotExceptions !== undefined) {
    data.slotExceptions = {
      deleteMany: {},
      create: slotExceptions.map((exc) => ({
        date: new Date(exc.date),
        isClosed: exc.isClosed ?? false,
        startTime: exc.startTime,
        endTime: exc.endTime,
        slotDurationMinutes: exc.slotDurationMinutes,
        slotCapacity: exc.slotCapacity,
      })),
    };
  }

  return this.prisma.facility.update({
    where: { id },
    data,
    include: {
      slotConfig: true,
      slotExceptions: true,
    },
  });
}

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.facility.delete({
      where: { id },
    });
  }
}
