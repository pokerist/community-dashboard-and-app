import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateResidentVehicleDto } from './dto/create-resident-vehicle.dto';
import { UpdateResidentVehicleDto } from './dto/update-resident-vehicle.dto';

@Injectable()
export class ResidentVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePlateNumber(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/-/g, ' ');
  }

  private validatePlateFormat(value: string) {
    // Keep validation permissive for Arabic/English plates while blocking symbols/noise.
    if (!/^[\p{L}\p{N}\s]+$/u.test(value)) {
      throw new BadRequestException(
        'Plate number should only include letters, numbers, and spaces',
      );
    }
  }

  private async getResidentIdForUser(userId: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) {
      throw new ForbiddenException('Resident profile is required for vehicle management');
    }
    return resident.id;
  }

  async listMyVehicles(userId: string) {
    const residentId = await this.getResidentIdForUser(userId);
    return this.prisma.residentVehicle.findMany({
      where: { residentId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createMyVehicle(userId: string, dto: CreateResidentVehicleDto) {
    const residentId = await this.getResidentIdForUser(userId);
    const normalizedPlate = this.normalizePlateNumber(dto.plateNumber);
    this.validatePlateFormat(normalizedPlate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary === true) {
          await tx.residentVehicle.updateMany({
            where: { residentId, isPrimary: true },
            data: { isPrimary: false },
          });
        }

        return tx.residentVehicle.create({
          data: {
            residentId,
            vehicleType: dto.vehicleType.trim(),
            model: dto.model.trim(),
            plateNumber: dto.plateNumber.trim(),
            plateNumberNormalized: normalizedPlate,
            color: dto.color?.trim() || null,
            notes: dto.notes?.trim() || null,
            isPrimary: dto.isPrimary === true,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('A vehicle with this plate already exists');
      }
      throw error;
    }
  }

  async updateMyVehicle(
    userId: string,
    vehicleId: string,
    dto: UpdateResidentVehicleDto,
  ) {
    const residentId = await this.getResidentIdForUser(userId);
    if (Object.keys(dto ?? {}).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.prisma.residentVehicle.findFirst({
      where: { id: vehicleId, residentId },
    });
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }

    const normalizedPlate = dto.plateNumber
      ? this.normalizePlateNumber(dto.plateNumber)
      : undefined;
    if (normalizedPlate) {
      this.validatePlateFormat(normalizedPlate);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isPrimary === true) {
          await tx.residentVehicle.updateMany({
            where: { residentId, isPrimary: true, id: { not: vehicleId } },
            data: { isPrimary: false },
          });
        }

        return tx.residentVehicle.update({
          where: { id: vehicleId },
          data: {
            ...(dto.vehicleType !== undefined
              ? { vehicleType: dto.vehicleType.trim() }
              : {}),
            ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
            ...(dto.plateNumber !== undefined
              ? {
                  plateNumber: dto.plateNumber.trim(),
                  plateNumberNormalized: normalizedPlate,
                }
              : {}),
            ...(dto.color !== undefined ? { color: dto.color?.trim() || null } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
            ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('A vehicle with this plate already exists');
      }
      throw error;
    }
  }

  async deleteMyVehicle(userId: string, vehicleId: string) {
    const residentId = await this.getResidentIdForUser(userId);
    const existing = await this.prisma.residentVehicle.findFirst({
      where: { id: vehicleId, residentId },
      select: { id: true, isPrimary: true, createdAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.residentVehicle.delete({
        where: { id: vehicleId },
      });

      if (existing.isPrimary) {
        const nextVehicle = await tx.residentVehicle.findFirst({
          where: { residentId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (nextVehicle) {
          await tx.residentVehicle.update({
            where: { id: nextVehicle.id },
            data: { isPrimary: true },
          });
        }
      }

      return { success: true, id: vehicleId };
    });
  }
}

