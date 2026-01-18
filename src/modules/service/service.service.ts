// src/service/service.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin: Creates a new Service Type (e.g., Furniture Permit).
   */
  async create(createServiceDto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        ...createServiceDto,
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
  async findAll(status: boolean | undefined) {
    const whereCondition = status === undefined ? {} : { status };

    return this.prisma.service.findMany({
      where: whereCondition,
      // Include form fields to render the input form in the Community App
      include: {
        formFields: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
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
    } catch (error) {
      if (error.code === 'P2025') {
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
}
