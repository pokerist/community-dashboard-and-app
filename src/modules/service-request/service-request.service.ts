// src/service-request/service-request.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';

@Injectable()
export class ServiceRequestService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new Service Request, including attachments and dynamic field values,
   * all within a single transaction.
   */
  async create(
    createdById: string,
    createServiceRequestDto: CreateServiceRequestDto,
  ) {
    const {
      serviceId,
      unitId,
      description,
      priority,
      attachmentIds = [],
      fieldValues = [], // Get the new field values
    } = createServiceRequestDto;

    // 1. Core Validation (Ensure service is active, required fields are present)
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      // Eagerly load the required ServiceFields for validation
      include: { formFields: { where: { required: true } } },
    });

    if (!service || !service.status) {
      throw new BadRequestException(
        'The requested service is invalid or currently inactive.',
      );
    }

    // Check for missing required dynamic fields
    const requiredFieldIds = service.formFields.map((f) => f.id);
    const submittedFieldIds = fieldValues.map((fv) => fv.fieldId);

    const missingRequiredFields = requiredFieldIds.filter(
      (id) => !submittedFieldIds.includes(id),
    );
    if (missingRequiredFields.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingRequiredFields.join(', ')}`,
      );
    }

    // 2. Perform transaction for atomicity
    const request = await this.prisma.$transaction(async (tx) => {
      // A. Create the ServiceRequest record
      const newRequest = await tx.serviceRequest.create({
        data: {
          serviceId,
          unitId,
          description,
          createdById,
          priority: priority ?? 'MEDIUM',
        },
      });

      // B. Create the Attachment records (Existing Logic)
      if (attachmentIds.length > 0) {
        const attachmentsData = attachmentIds.map((fileId) => ({
          fileId: fileId,
          serviceRequestId: newRequest.id,
        }));
        await tx.attachment.createMany({
          data: attachmentsData,
          skipDuplicates: true,
        });
      }

      // C. Create the ServiceRequestFieldValue records (NEW LOGIC)
      if (fieldValues.length > 0) {
        const fieldValueCreationData = fieldValues.map((fv) => ({
          requestId: newRequest.id,
          ...fv, // Spread the fieldId and value fields
        }));

        await tx.serviceRequestFieldValue.createMany({
          data: fieldValueCreationData,
        });
      }

      return newRequest;
    });

    // 3. Return a rich response
    return this.prisma.serviceRequest.findUnique({
      where: { id: request.id },
      include: {
        service: { select: { name: true, category: true } },
        attachments: { include: { file: true } },
        fieldValues: { include: { field: true } }, // Include the saved field values
      },
    });
  }

  /**
   * 2. Finds all Service Requests (for Dashboard/Admin view).
   */
  async findAll() {
    return this.prisma.serviceRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        unit: { select: { unitNumber: true, block: true } },
        createdBy: { select: { nameEN: true, phone: true } },
        service: { select: { name: true } },
      },
    });
  }

  /**
   * 3. Finds all Service Requests for a specific user (for Community App's 'My Requests').
   */
  async findByUser(userId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { createdById: userId },
      orderBy: { requestedAt: 'desc' },
      include: {
        service: { select: { name: true } },
        // You might want to include status history logs if you implement that later
      },
    });
  }

  /**
   * 4. Updates a specific Service Request (e.g., change status, assignee).
   */
  async update(
    id: string,
    updateServiceRequestDto: UpdateServiceRequestInternalDto,
  ) {
    // CHANGE DTO HERE
    try {
      return await this.prisma.serviceRequest.update({
        where: { id },
        data: updateServiceRequestDto, // This is now safe as it doesn't contain serviceId
      });
    } catch (error) {
      // Prisma P2025 error for record not found
      if (error.code === 'P2025') {
        throw new NotFoundException(`Service Request with ID ${id} not found.`);
      }
      throw error;
    }
  }

  /**
   * 5. Find a single request by ID with all related data.
   */
  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        unit: true,
        createdBy: true,
        service: true,
        attachments: { include: { file: true } }, // Include file details
        fieldValues: {
          include: { field: true }, // Include the submitted field value and the field metadata (label, type)
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    return request;
  }
}
