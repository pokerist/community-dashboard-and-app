import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EligibilityType,
  Audience,
  Channel,
  InvoiceType,
  NotificationType,
  Priority as PriorityEnum,
  ServiceCategory,
  ServiceFieldType,
  ServiceRequestStatus,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ServiceRequestCreatedEvent } from '../../events/contracts/service-request-created.event';
import { ServiceRequestStatusChangedEvent } from '../../events/contracts/service-request-status-changed.event';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { CancelServiceRequestDto } from './dto/cancel-service-request.dto';
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
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2,
  ) {}

  private kindToServiceCategoryFilter(kind?: 'services' | 'requests' | 'all') {
    if (kind === 'requests') {
      return { in: [ServiceCategory.REQUESTS, ServiceCategory.ADMIN] as const };
    }
    if (kind === 'services') {
      return { notIn: [ServiceCategory.REQUESTS, ServiceCategory.ADMIN] as const };
    }
    return undefined;
  }

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
    const createdRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: request.id },
      include: {
        service: { select: { id: true, name: true, category: true } },
        attachments: { include: { file: true } },
        fieldValues: { include: { field: true } },
      },
    });

    if (createdRequest) {
      try {
        this.eventEmitter.emit(
          'service_request.created',
          new ServiceRequestCreatedEvent(
            createdRequest.id,
            createdRequest.createdById,
            createdRequest.serviceId,
            String(createdRequest.service?.name ?? 'Service request'),
            createdRequest.service?.category ?? null,
            createdRequest.unitId ?? null,
            createdRequest.status,
            (createdRequest.priority as PriorityEnum) ?? PriorityEnum.MEDIUM,
          ),
        );
      } catch (error) {
        // Don't fail the primary flow if notification emission fails.
        void error;
      }
    }

    return createdRequest;
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
  async findAll(kind: 'services' | 'requests' | 'all' = 'all') {
    const categoryFilter = this.kindToServiceCategoryFilter(kind);
    return this.prisma.serviceRequest.findMany({
      where: categoryFilter ? { service: { category: categoryFilter as any } } : undefined,
      orderBy: { requestedAt: 'desc' },
      include: {
        unit: { select: { unitNumber: true, block: true } },
        createdBy: { select: { id: true, nameEN: true, email: true, phone: true } },
        service: { select: { id: true, name: true, category: true, isUrgent: true } },
      },
    });
  }

  /**
   * Community App "My requests".
   */
  async findByUser(
    userId: string,
    kind: 'services' | 'requests' | 'all' = 'all',
  ) {
    const categoryFilter = this.kindToServiceCategoryFilter(kind);
    return this.prisma.serviceRequest.findMany({
      where: {
        createdById: userId,
        ...(categoryFilter ? { service: { category: categoryFilter as any } } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      include: {
        service: { select: { id: true, name: true, category: true, isUrgent: true } },
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, body: true, createdAt: true, createdById: true },
        },
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
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: {
              select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
            },
          },
        },
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
    const existing = await this.findOne(id);

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
          dto.status === ServiceRequestStatus.CANCELLED &&
          !perms.includes('service_request.close')
        ) {
          throw new ForbiddenException(
            'You do not have permission to cancel service requests',
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

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: dto,
    });

    if (
      dto.status &&
      existing.status &&
      dto.status !== existing.status
    ) {
      try {
        const service = await this.prisma.service.findUnique({
          where: { id: existing.serviceId },
          select: { id: true, name: true, category: true },
        });
        this.eventEmitter.emit(
          'service_request.status_changed',
          new ServiceRequestStatusChangedEvent(
            existing.id,
            existing.createdById,
            existing.serviceId,
            String(service?.name ?? 'Service request'),
            service?.category ?? null,
            existing.unitId ?? null,
            existing.status,
            dto.status,
            existing.priority,
            ctx.actorUserId,
          ),
        );
      } catch (error) {
        void error;
      }
    }

    return updated;
  }

  async listCommentsForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    const request = await this.findOneForActor(id, ctx);
    const canViewAll =
      isSuperAdminRole(ctx.roles) ||
      (Array.isArray(ctx.permissions) &&
        ctx.permissions.includes('service_request.view_all'));

    return this.prisma.serviceRequestComment.findMany({
      where: {
        requestId: request.id,
        ...(canViewAll ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        createdBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
        },
      },
    });
  }

  async addCommentForActor(
    id: string,
    dto: CreateServiceRequestCommentDto,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    const request = await this.findOneForActor(id, ctx);
    const canViewAll =
      isSuperAdminRole(ctx.roles) ||
      (Array.isArray(ctx.permissions) &&
        ctx.permissions.includes('service_request.view_all'));

    if (dto.isInternal && !canViewAll) {
      throw new ForbiddenException('Internal comments are allowed for staff only');
    }

    const comment = await this.prisma.serviceRequestComment.create({
      data: {
        requestId: request.id,
        createdById: ctx.actorUserId,
        body: dto.body.trim(),
        isInternal: canViewAll ? Boolean(dto.isInternal) : false,
      },
      include: {
        createdBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
        },
      },
    });

    if (canViewAll && !comment.isInternal && request.createdById !== ctx.actorUserId) {
      try {
        const serviceCategory =
          (request.service as any)?.category ?? ServiceCategory.OTHER;
        await this.notificationsService.sendNotification({
          type: NotificationType.MAINTENANCE_ALERT,
          title: 'New update on your request',
          messageEn: `The management team replied to your ${String((request.service as any)?.name ?? 'service request')}.`,
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [request.createdById] },
          payload: {
            route:
              serviceCategory === ServiceCategory.REQUESTS ||
              serviceCategory === ServiceCategory.ADMIN
                ? '/requests'
                : '/services',
            entityType: 'SERVICE_REQUEST',
            entityId: request.id,
            eventKey: 'service_request.comment_added',
          },
        });
      } catch (error) {
        void error;
      }
    }

    return comment;
  }

  async cancelForActor(
    id: string,
    dto: CancelServiceRequestDto,
    ctx: { actorUserId: string; permissions: string[]; roles: string[] },
  ) {
    const request = await this.findOneForActor(id, ctx);

    if (request.createdById !== ctx.actorUserId) {
      throw new ForbiddenException('Only the requester can cancel this ticket');
    }

    if (request.status !== ServiceRequestStatus.NEW) {
      throw new BadRequestException(
        'This request can no longer be cancelled because it is already under review or completed.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceRequest.update({
        where: { id: request.id },
        data: { status: ServiceRequestStatus.CANCELLED },
      });

      const reason = dto.reason?.trim();
      if (reason) {
        await tx.serviceRequestComment.create({
          data: {
            requestId: request.id,
            createdById: ctx.actorUserId,
            body: `Cancelled by owner: ${reason}`,
            isInternal: false,
          },
        });
      } else {
        await tx.serviceRequestComment.create({
          data: {
            requestId: request.id,
            createdById: ctx.actorUserId,
            body: 'Cancelled by owner',
            isInternal: false,
          },
        });
      }

      return updated;
    });

    try {
      const service = await this.prisma.service.findUnique({
        where: { id: request.serviceId },
        select: { id: true, name: true, category: true },
      });
      this.eventEmitter.emit(
        'service_request.status_changed',
        new ServiceRequestStatusChangedEvent(
          request.id,
          request.createdById,
          request.serviceId,
          String(service?.name ?? 'Service request'),
          service?.category ?? null,
          request.unitId ?? null,
          request.status,
          ServiceRequestStatus.CANCELLED,
          request.priority,
          ctx.actorUserId,
        ),
      );
    } catch (error) {
      void error;
    }

    return result;
  }
}
