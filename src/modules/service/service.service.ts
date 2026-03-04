// src/service/service.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServiceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin: Creates a new Service Type (e.g., Furniture Permit).
   */
  async create(createServiceDto: CreateServiceDto) {
    let displayOrder = createServiceDto.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const maxOrder = await this.prisma.service.aggregate({
        _max: { displayOrder: true },
      });
      displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;
    }
    return this.prisma.service.create({
      data: {
        ...createServiceDto,
        displayOrder,
        // Ensure startingPrice is stored as Decimal
        startingPrice: createServiceDto.startingPrice
          ? parseFloat(createServiceDto.startingPrice)
          : undefined,
      },
    });
  }

  /**
   * Community App/Admin: Retrieves all active services.
   * Can be filtered for dashboard by status/category.
   */
  async findAll(
    status: boolean | undefined,
    isUrgent: boolean | undefined = undefined,
    category?: string,
    kind: 'services' | 'requests' | 'all' = 'all',
  ) {
    const whereCondition: Prisma.ServiceWhereInput = {};
    if (status !== undefined) whereCondition.status = status;
    if (isUrgent !== undefined) whereCondition.isUrgent = isUrgent;
    if (category) {
      whereCondition.category = String(category).toUpperCase() as any;
    } else if (kind === 'requests') {
      whereCondition.category = { in: ['REQUESTS', 'ADMIN'] as any };
    } else if (kind === 'services') {
      whereCondition.category = { notIn: ['REQUESTS', 'ADMIN'] as any };
    }

    return this.prisma.service.findMany({
      where: whereCondition,
      // Include form fields to render the input form in the Community App
      include: {
        formFields: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Admin: Retrieves a single service by ID.
   */
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { formFields: true },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }
    return service;
  }

  /**
   * Admin: Updates an existing Service Type (e.g., change its status, price, or description).
   */
  async update(id: string, updateServiceDto: UpdateServiceDto) {
    try {
      return await this.prisma.service.update({
        where: { id },
        data: {
          ...updateServiceDto,
          startingPrice: updateServiceDto.startingPrice
            ? parseFloat(updateServiceDto.startingPrice)
            : undefined,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Service with ID ${id} not found.`);
      }
      throw error;
    }
  }

  /**
   * Admin: Removes a Service Type.
   */
  async remove(id: string) {
    // NOTE: Before deleting, ensure there are no existing ServiceRequests linked.
    // For safety, you should usually soft-delete (set status=false) instead of hard-deleting.
    const existingRequests = await this.prisma.serviceRequest.count({
      where: { serviceId: id },
    });
    if (existingRequests > 0) {
      throw new BadRequestException(
        'Cannot delete service: there are existing requests linked. Set status to false instead.',
      );
    }

    return this.prisma.service.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length !== ids.length) {
      throw new BadRequestException('Duplicate IDs are not allowed in reorder payload.');
    }

    const existing = await this.prisma.service.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (existing.length !== uniqueIds.length) {
      throw new NotFoundException('One or more service IDs do not exist.');
    }

    await this.prisma.$transaction(
      uniqueIds.map((id, index) =>
        this.prisma.service.update({
          where: { id },
          data: { displayOrder: index + 1 },
        }),
      ),
    );

    return { success: true, updated: uniqueIds.length };
  }
}
