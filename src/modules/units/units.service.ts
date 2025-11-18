import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Unit } from '@prisma/client';
import { CreateUnitDto } from './dto/create-unit.dto';
// Assuming UpdateUnitDto extends CreateUnitDto and makes fields optional

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  // READ: List all Units (for the UNITS page list)
  async findAll(): Promise<Unit[]> {
    return this.prisma.unit.findMany({
      orderBy: { unitNumber: 'asc' },
      // Include residents count for quick dashboard data
      include: {
        residents: true
      }
    });
  }

  // CREATE: Add Unit (from the 'Add Unit' button)
  async create(data: CreateUnitDto): Promise<Unit> {
    // Default status when creating a new unit
    return this.prisma.unit.create({
      data: {
        ...data,
        status: 'AVAILABLE',
      },
    });
  }

  // READ: Get a single Unit by ID
  async findOne(id: string): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: { 
          residents: { include: { user: true } }, // Show who lives there
          leases: true
      }
    });
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found.`);
    }
    return unit;
  }

  // UPDATE: Update Unit details
  async update(id: string, data: Partial<CreateUnitDto>): Promise<Unit> {
    return this.prisma.unit.update({
      where: { id },
      data,
    });
  }

  // DELETE: Remove a Unit
  async remove(id: string): Promise<Unit> {
    // Note: Add logic/guard here to prevent deletion if unit is occupied or has active leases
    return this.prisma.unit.delete({
      where: { id },
    });
  }
}