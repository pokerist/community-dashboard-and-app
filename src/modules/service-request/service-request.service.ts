import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EligibilityType,
  InvoiceType,
  ServiceFieldType,
  ServiceRequestStatus,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';

function isSuperAdminRole(roles: unknown): boolean {
  return (
    Array.isArray(roles) &&
    roles.some(
      (r) => typeof r === 'string' && r.toUpperCase() === 'SUPER_ADMIN',
    )
  );
}

function isUnitDelivered(status: UnitStatus): boolean {
  return (
    status === UnitStatus.DELIVERED ||
    status === UnitStatus.OCCUPIED ||
    status === UnitStatus.LEASED
  );
}

@Injectable()
export class ServiceRequestService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  /**
   * Creates a new Service Request, including attachments and dynamic field values,
   * all within a single transaction.
   */
  async create(createdById: string, dto: CreateServiceRequestDto) {
    const {
      serviceId,
      unitId,
      description,
      priority,
      attachmentIds = [],
      fieldValues = [],
    } = dto;

    // 1) Access control: user must have ACTIVE access to the unit.
    await getActiveUnitAccess(this.prisma, createdById, unitId);

    // 2) Fetch unit status (needed for eligibility checks).
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { status: true },
    });
    if (!unit) throw new NotFoundException(`Unit ${unitId} not found.`);

    // 3) Validate service and load its form fields (for dynamic field validation).
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        formFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!service || !service.status) {
      throw new BadRequestException(
        'The requested service is invalid or currently inactive.',
      );
    }

    // 4) Enforce service eligibility against unit delivery status.
    const delivered = isUnitDelivered(unit.status);
    if (
      service.unitEligibility === EligibilityType.DELIVERED_ONLY &&
      !delivered
    ) {
      throw new BadRequestException(
        'This service is only available for delivered units.',
      );
    }
    if (
      service.unitEligibility === EligibilityType.NON_DELIVERED_ONLY &&
      delivered
    ) {
      throw new BadRequestException(
        'This service is only available for non-delivered units.',
      );
    }

    // 5) Validate submitted dynamic field values.
    const fieldsById = new Map(service.formFields.map((f) => [f.id, f]));

    const submittedFieldIds = fieldValues.map((fv) => fv.fieldId);
    const uniqueSubmittedFieldIds = new Set(submittedFieldIds);
    if (uniqueSubmittedFieldIds.size !== submittedFieldIds.length) {
      throw new BadRequestException('Duplicate fieldId entries are not allowed.');
    }

    const invalidFieldIds = submittedFieldIds.filter((id) => !fieldsById.has(id));
    if (invalidFieldIds.length > 0) {
      throw new BadRequestException(
        `Invalid fieldId(s) for this service: ${invalidFieldIds.join(', ')}`,
      );
    }

    const requiredFields = service.formFields.filter((f) => f.required);
    const missingRequired = requiredFields.filter(
      (f) => !uniqueSubmittedFieldIds.has(f.id),
    );
    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingRequired
          .map((f) => f.label)
          .join(', ')}`,
      );
    }

    for (const fv of fieldValues) {
      const field = fieldsById.get(fv.fieldId)!;

      const providedCount =
        (fv.valueText !== undefined && fv.valueText !== '' ? 1 : 0) +
        (fv.valueNumber !== undefined ? 1 : 0) +
        (fv.valueBool !== undefined ? 1 : 0) +
        (fv.valueDate !== undefined ? 1 : 0) +
        (fv.fileAttachmentId !== undefined ? 1 : 0);

      if (providedCount !== 1) {
        throw new BadRequestException(
          `Field "${field.label}" must have exactly one value set.`,
        );
      }

      switch (field.type) {
        case ServiceFieldType.TEXT:
        case ServiceFieldType.TEXTAREA:
        case ServiceFieldType.MEMBER_SELECTOR: {
          if (fv.valueText === undefined || fv.valueText === '') {
            throw new BadRequestException(
              `Field "${field.label}" expects a text value.`,
            );
          }
          break;
        }
        case ServiceFieldType.NUMBER: {
          if (fv.valueNumber === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a numeric value.`,
            );
          }
          break;
        }
        case ServiceFieldType.BOOLEAN: {
          if (fv.valueBool === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a boolean value.`,
            );
          }
          break;
        }
        case ServiceFieldType.DATE: {
          if (fv.valueDate === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a date value.`,
            );
          }
          break;
        }
        case ServiceFieldType.FILE: {
          if (fv.fileAttachmentId === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a fileAttachmentId value.`,
            );
          }
          break;
        }
        default:
          throw new BadRequestException(
            `Field "${field.label}" has unsupported type "${field.type}".`,
          );
      }
    }

    // 6) Perform transaction for atomicity.
    const request = await this.prisma.$transaction(async (tx) => {
      const newRequest = await tx.serviceRequest.create({
        data: {
          serviceId,
          unitId,
          description,
          createdById,
          priority: priority ?? 'MEDIUM',
        },
      });

      if (attachmentIds.length > 0) {
        const attachmentsData = attachmentIds.map((fileId) => ({
          fileId,
          serviceRequestId: newRequest.id,
          entityId: newRequest.id,
          entity: 'SERVICE_REQUEST',
        }));
        await tx.attachment.createMany({
          data: attachmentsData,
          skipDuplicates: true,
        });
      }

      if (fieldValues.length > 0) {
        await tx.serviceRequestFieldValue.createMany({
          data: fieldValues.map((fv) => ({
            requestId: newRequest.id,
            fieldId: fv.fieldId,
            valueText: fv.valueText,
            valueNumber: fv.valueNumber,
            valueBool: fv.valueBool,
            valueDate: fv.valueDate ? new Date(fv.valueDate as any) : undefined,
            fileAttachmentId: fv.fileAttachmentId,
          })),
        });
      }

      return newRequest;
    });

    // 7) Return a rich response.
    return this.prisma.serviceRequest.findUnique({
      where: { id: request.id },
      include: {
        service: { select: { name: true, category: true } },
        attachments: { include: { file: true } },
        fieldValues: { include: { field: true } },
      },
    });
  }

  /**
   * Create an invoice for a Service Request (e.g., maintenance charge).
   * This method delegates invoice creation to InvoicesService.generateInvoice.
   */
  async createInvoiceForRequest(
    requestId: string,
    amount: number,
    dueDate: Date,
    type: InvoiceType = InvoiceType.MAINTENANCE_FEE,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        unit: {
          select: {
            id: true,
            residents: {
              where: { isPrimary: true },
              select: { residentId: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!request)
      throw new NotFoundException(`Service Request ${requestId} not found`);

    // Resolve primary resident: prefer creator, otherwise use primary resident on unit.
    let residentId: string | undefined = request.createdById;
    const unitId = request.unitId ?? request.unit?.id;

    if (!unitId)
      throw new BadRequestException('Service Request has no associated unit.');

    if (!residentId)
      residentId = request.unit?.residents?.[0]?.residentId ?? undefined;

    return this.invoicesService.generateInvoice({
      unitId,
      residentId,
      amount,
      dueDate,
      type,
      sources: { serviceRequestIds: [requestId] },
    });
  }

  /**
   * Dashboard/Admin view.
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
   * Community App "My requests".
   */
  async findByUser(userId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { createdById: userId },
      orderBy: { requestedAt: 'desc' },
      include: {
        service: { select: { name: true } },
      },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        unit: true,
        createdBy: true,
        service: true,
        attachments: { include: { file: true } },
        fieldValues: { include: { field: true } },
      },
    });

    if (!request) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    return request;
  }

  async findOneForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    const request = await this.findOne(id);

    const canViewAll =
      isSuperAdminRole(ctx.roles) ||
      (Array.isArray(ctx.permissions) &&
        ctx.permissions.includes('service_request.view_all'));
    if (canViewAll) return request;

    if (request.createdById !== ctx.actorUserId) {
      throw new ForbiddenException(
        'You do not have access to this service request',
      );
    }

    return request;
  }

  async updateForActor(
    id: string,
    dto: UpdateServiceRequestInternalDto,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    await this.findOne(id);

    const isSuperAdmin = isSuperAdminRole(ctx.roles);
    const perms = Array.isArray(ctx.permissions) ? ctx.permissions : [];

    if (!isSuperAdmin) {
      if (dto.assignedToId !== undefined && !perms.includes('service_request.assign')) {
        throw new ForbiddenException(
          'You do not have permission to assign service requests',
        );
      }

      if (dto.status !== undefined) {
        if (
          dto.status === ServiceRequestStatus.RESOLVED &&
          !perms.includes('service_request.resolve')
        ) {
          throw new ForbiddenException(
            'You do not have permission to resolve service requests',
          );
        }
        if (
          dto.status === ServiceRequestStatus.CLOSED &&
          !perms.includes('service_request.close')
        ) {
          throw new ForbiddenException(
            'You do not have permission to close service requests',
          );
        }
        if (
          (dto.status === ServiceRequestStatus.NEW ||
            dto.status === ServiceRequestStatus.IN_PROGRESS) &&
          !perms.includes('service_request.assign')
        ) {
          throw new ForbiddenException(
            'You do not have permission to update service request status',
          );
        }
      }
    }

    if (dto.assignedToId !== undefined) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedToId },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException('Assigned To ID is invalid.');
      }
    }

    return this.prisma.serviceRequest.update({
      where: { id },
      data: dto,
    });
  }
}

