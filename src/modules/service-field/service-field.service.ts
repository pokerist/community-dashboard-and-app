// src/service/service-field.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceFieldDto } from './dto/create-service-field.dto';
import { UpdateServiceFieldDto } from './dto/update-service-field.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServiceFieldService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin: Adds a new custom field to a Service.
   */
  async create(createServiceFieldDto: CreateServiceFieldDto) {
    const { serviceId, label } = createServiceFieldDto;

    // 1. Ensure the parent Service exists
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found.`);
    }

    // 2. Prevent duplicate labels for the same service
    const existingField = await this.prisma.serviceField.findFirst({
      where: { serviceId, label },
    });
    if (existingField) {
      throw new BadRequestException(
        `A field with label "${label}" already exists for this service.`,
      );
    }

    // 3. Create the new field
    return this.prisma.serviceField.create({
      data: createServiceFieldDto,
    });
  }

  /**
   * Admin: Retrieves all fields for a specific Service.
   */
  async findByService(serviceId: string) {
    return this.prisma.serviceField.findMany({
      where: { serviceId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Admin: Updates an existing Service Field.
   */
  async update(id: string, updateServiceFieldDto: UpdateServiceFieldDto) {
    try {
      return await this.prisma.serviceField.update({
        where: { id },
        data: updateServiceFieldDto,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Service Field with ID ${id} not found.`);
      }
      throw error;
    }
  }

  /**
   * Admin: Deletes a Service Field.
   */
  async remove(id: string) {
    // Safety check: Cannot delete a field if there are existing ServiceRequestFieldValues linked to it.
    const existingValues = await this.prisma.serviceRequestFieldValue.count({
      where: { fieldId: id },
    });
    if (existingValues > 0) {
      throw new BadRequestException(
        'Cannot delete field: Existing requests depend on this field. Consider updating the Service to inactive instead.',
      );
    }

    return this.prisma.serviceField.delete({ where: { id } });
  }
}
