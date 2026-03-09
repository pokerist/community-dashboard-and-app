import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EligibilityType,
  InvoiceType,
  Priority,
  Prisma,
  ServiceCategory,
  ServiceFieldType,
  ServiceRequestStatus,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { InvoicesService } from '../invoices/invoices.service';
import { AssignRequestDto } from './dto/assign-request.dto';
import { CancelServiceRequestDto } from './dto/cancel-service-request.dto';
import { CreateServiceRequestCommentDto } from './dto/create-service-request-comment.dto';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { FieldValueDto } from './dto/field-value.dto';
import { ListServiceRequestsQueryDto } from './dto/list-service-requests-query.dto';
import {
  ServiceRequestCommentResponseDto,
  ServiceRequestDetailDto,
  ServiceRequestInvoiceResponseDto,
  ServiceRequestListItemDto,
  ServiceRequestSlaInfoDto,
  ServiceRequestSlaStatus,
} from './dto/service-request-response.dto';
import { SubmitRatingDto } from './dto/submit-rating.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { UpdateServiceRequestInternalDto } from './dto/update-service-request-internal.dto';

interface ActorContext {
  actorUserId: string;
  permissions: string[];
  roles: string[];
}

function isSuperAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toUpperCase() === 'SUPER_ADMIN');
}

function isUnitDelivered(status: UnitStatus): boolean {
  return status === UnitStatus.DELIVERED;
}

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  private canViewAllRequests(ctx: ActorContext): boolean {
    return (
      isSuperAdminRole(ctx.roles) ||
      ctx.permissions.includes('service_request.view_all')
    );
  }

  private buildRequestNumber(id: string): string {
    return `SR-${id.slice(0, 8).toUpperCase()}`;
  }

  private asDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private toIso(value: Date | string | null | undefined): string | null {
    const date = this.asDate(value);
    return date ? date.toISOString() : null;
  }

  private computeSlaInfo(params: {
    requestedAt: Date;
    status: ServiceRequestStatus;
    slaHours: number | null;
    slaBreachedAt: Date | null;
  }): ServiceRequestSlaInfoDto {
    const resolvedStates = new Set<ServiceRequestStatus>([
      ServiceRequestStatus.RESOLVED,
      ServiceRequestStatus.CLOSED,
      ServiceRequestStatus.CANCELLED,
    ]);

    if (resolvedStates.has(params.status)) {
      return {
        status: 'RESOLVED',
        deadline: params.slaHours
          ? new Date(
              params.requestedAt.getTime() + params.slaHours * 60 * 60 * 1000,
            ).toISOString()
          : null,
        hoursRemaining: null,
        hoursOverdue: null,
      };
    }

    if (!params.slaHours) {
      return {
        status: 'NO_SLA',
        deadline: null,
        hoursRemaining: null,
        hoursOverdue: null,
      };
    }

    const now = new Date();
    const deadline = new Date(
      params.requestedAt.getTime() + params.slaHours * 60 * 60 * 1000,
    );
    const deltaHours = Math.floor(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60),
    );

    if (params.slaBreachedAt || deltaHours < 0) {
      return {
        status: 'BREACHED',
        deadline: deadline.toISOString(),
        hoursRemaining: deltaHours,
        hoursOverdue: Math.abs(deltaHours),
      };
    }

    return {
      status: 'ON_TRACK',
      deadline: deadline.toISOString(),
      hoursRemaining: deltaHours,
      hoursOverdue: null,
    };
  }

  private async validateDynamicFieldValues(params: {
    service: {
      formFields: {
        id: string;
        label: string;
        type: ServiceFieldType;
        required: boolean;
      }[];
    };
    fieldValues: FieldValueDto[];
  }): Promise<void> {
    const fieldsById = new Map(
      params.service.formFields.map((field) => [field.id, field]),
    );

    const submittedFieldIds = params.fieldValues.map((fieldValue) => fieldValue.fieldId);
    if (new Set(submittedFieldIds).size !== submittedFieldIds.length) {
      throw new BadRequestException('Duplicate fieldId entries are not allowed.');
    }

    const invalidFieldIds = submittedFieldIds.filter((id) => !fieldsById.has(id));
    if (invalidFieldIds.length > 0) {
      throw new BadRequestException(
        `Invalid fieldId(s) for this service: ${invalidFieldIds.join(', ')}`,
      );
    }

    const missingRequired = params.service.formFields.filter(
      (field) => field.required && !submittedFieldIds.includes(field.id),
    );
    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingRequired
          .map((field) => field.label)
          .join(', ')}`,
      );
    }

    for (const fieldValue of params.fieldValues) {
      const field = fieldsById.get(fieldValue.fieldId);
      if (!field) continue;

      const providedCount =
        (fieldValue.valueText !== undefined && fieldValue.valueText !== '' ? 1 : 0) +
        (fieldValue.valueNumber !== undefined ? 1 : 0) +
        (fieldValue.valueBool !== undefined ? 1 : 0) +
        (fieldValue.valueDate !== undefined ? 1 : 0) +
        (fieldValue.fileAttachmentId !== undefined ? 1 : 0);

      if (providedCount !== 1) {
        throw new BadRequestException(
          `Field "${field.label}" must have exactly one value set.`,
        );
      }

      switch (field.type) {
        case ServiceFieldType.TEXT:
        case ServiceFieldType.TEXTAREA:
        case ServiceFieldType.MEMBER_SELECTOR:
          if (fieldValue.valueText === undefined || fieldValue.valueText === '') {
            throw new BadRequestException(
              `Field "${field.label}" expects a text value.`,
            );
          }
          break;
        case ServiceFieldType.NUMBER:
          if (fieldValue.valueNumber === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a numeric value.`,
            );
          }
          break;
        case ServiceFieldType.BOOLEAN:
          if (fieldValue.valueBool === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a boolean value.`,
            );
          }
          break;
        case ServiceFieldType.DATE:
          if (fieldValue.valueDate === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a date value.`,
            );
          }
          break;
        case ServiceFieldType.FILE:
          if (fieldValue.fileAttachmentId === undefined) {
            throw new BadRequestException(
              `Field "${field.label}" expects a fileAttachmentId value.`,
            );
          }
          break;
        default:
          throw new BadRequestException(
            `Field "${field.label}" has unsupported type "${field.type}".`,
          );
      }
    }
  }

  private normalizeCategoryFilter(
    kind?: 'services' | 'requests' | 'all',
  ): { in?: ServiceCategory[]; notIn?: ServiceCategory[] } | undefined {
    if (kind === 'requests') {
      return { in: [ServiceCategory.REQUESTS, ServiceCategory.ADMIN] };
    }
    if (kind === 'services') {
      return { notIn: [ServiceCategory.REQUESTS, ServiceCategory.ADMIN] };
    }
    return undefined;
  }

  private buildInternalNoteLine(note: string, authorId: string): string {
    return `[${new Date().toISOString()}][${authorId}] ${note.trim()}`;
  }

  private appendInternalNote(
    current: string | null,
    note: string,
    authorId: string,
  ): string {
    const nextLine = this.buildInternalNoteLine(note, authorId);
    if (!current || !current.trim()) {
      return nextLine;
    }
    return `${current.trim()}\n${nextLine}`;
  }

  private mapComment(row: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date | string;
    createdBy: { id: string; nameEN: string | null; email: string | null };
  }): ServiceRequestCommentResponseDto {
    return {
      id: row.id,
      body: row.body,
      isInternal: row.isInternal,
      createdAt: this.toIso(row.createdAt) ?? new Date().toISOString(),
      authorId: row.createdBy.id,
      authorName: row.createdBy.nameEN ?? row.createdBy.email ?? 'Unknown',
    };
  }

  private mapInvoice(row: {
    id: string;
    invoiceNumber: string;
    amount: Prisma.Decimal;
    status: string;
    dueDate: Date | string;
  }): ServiceRequestInvoiceResponseDto {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      amount: Number(row.amount.toString()),
      status: row.status,
      dueDate: this.toIso(row.dueDate) ?? new Date().toISOString(),
    };
  }

  async create(createdById: string, dto: CreateServiceRequestDto): Promise<ServiceRequestDetailDto> {
    const { serviceId, unitId, description, priority, attachmentIds = [], fieldValues = [] } = dto;

    await getActiveUnitAccess(this.prisma, createdById, unitId);

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { status: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found.`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        formFields: {
          select: {
            id: true,
            label: true,
            type: true,
            required: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!service || !service.status) {
      throw new BadRequestException(
        'The requested service is invalid or currently inactive.',
      );
    }

    const delivered = isUnitDelivered(unit.status);
    if (service.unitEligibility === EligibilityType.DELIVERED_ONLY && !delivered) {
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

    await this.validateDynamicFieldValues({ service, fieldValues });

    const createdRequestId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceRequest.create({
        data: {
          serviceId,
          unitId,
          description,
          createdById,
          priority: priority ?? Priority.MEDIUM,
        },
        select: { id: true },
      });

      if (attachmentIds.length > 0) {
        await tx.attachment.createMany({
          data: attachmentIds.map((fileId) => ({
            fileId,
            serviceRequestId: created.id,
            entityId: created.id,
            entity: 'SERVICE_REQUEST',
          })),
          skipDuplicates: true,
        });
      }

      if (fieldValues.length > 0) {
        await tx.serviceRequestFieldValue.createMany({
          data: fieldValues.map((fieldValue) => ({
            requestId: created.id,
            fieldId: fieldValue.fieldId,
            valueText: fieldValue.valueText,
            valueNumber: fieldValue.valueNumber,
            valueBool: fieldValue.valueBool,
            valueDate: fieldValue.valueDate ? new Date(fieldValue.valueDate) : undefined,
            fileAttachmentId: fieldValue.fileAttachmentId,
          })),
        });
      }

      return created.id;
    });

    return this.getRequestDetail(createdRequestId);
  }

  async createInvoiceForRequest(
    requestId: string,
    amount: number,
    dueDate: Date,
  ): Promise<{ id: string }> {
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

    if (!request) {
      throw new NotFoundException(`Service Request ${requestId} not found`);
    }

    const unitId = request.unitId ?? request.unit?.id;
    if (!unitId) {
      throw new BadRequestException('Service Request has no associated unit.');
    }

    const residentId =
      request.createdById ?? request.unit?.residents[0]?.residentId ?? undefined;

    return this.invoicesService.generateInvoice({
      unitId,
      residentId,
      amount,
      dueDate,
      type: InvoiceType.MAINTENANCE_FEE,
      sources: { serviceRequestIds: [requestId] },
    });
  }

  async listRequests(
    filters: ListServiceRequestsQueryDto,
  ): Promise<ServiceRequestListItemDto[]> {
    const where: Prisma.ServiceRequestWhereInput = {};

    if (filters.serviceId) where.serviceId = filters.serviceId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    if (filters.unitId) where.unitId = filters.unitId;
    if (filters.createdById) where.createdById = filters.createdById;

    if (filters.dateFrom || filters.dateTo) {
      where.requestedAt = {};
      if (filters.dateFrom) {
        where.requestedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.requestedAt.lte = new Date(filters.dateTo);
      }
    }

    if (filters.slaBreached === true) {
      where.slaBreachedAt = { not: null };
      where.status = {
        in: [ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS],
      };
    }

    if (filters.slaBreached === false) {
      where.slaBreachedAt = null;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      const requestIdSearch = search.toUpperCase().startsWith('SR-')
        ? search.slice(3)
        : search;
      where.OR = [
        { id: { contains: requestIdSearch, mode: 'insensitive' } },
        { service: { name: { contains: search, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
        { createdBy: { nameEN: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.serviceRequest.findMany({
      where,
      include: {
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            slaHours: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            block: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    const assigneeIds = Array.from(
      new Set(rows.map((row) => row.assignedToId).filter((id): id is string => Boolean(id))),
    );

    const assignees =
      assigneeIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, nameEN: true, email: true },
          })
        : [];

    const assigneeById = new Map(
      assignees.map((assignee) => [
        assignee.id,
        assignee.nameEN ?? assignee.email ?? 'Unknown',
      ]),
    );

    return rows.map((row) => {
      const requestedAt = this.asDate(row.requestedAt) ?? new Date();
      const sla = this.computeSlaInfo({
        requestedAt,
        status: row.status,
        slaHours: row.service?.slaHours ?? null,
        slaBreachedAt: row.slaBreachedAt,
      });

      return {
        id: row.id,
        requestNumber: this.buildRequestNumber(row.id),
        serviceName: row.service?.name ?? 'Service Request',
        category: row.service?.category ?? ServiceCategory.OTHER,
        unitNumber: row.unit?.unitNumber ?? '—',
        requesterName: row.createdBy?.nameEN ?? row.createdBy?.email ?? 'Unknown',
        assigneeName: row.assignedToId ? assigneeById.get(row.assignedToId) ?? null : null,
        status: row.status,
        priority: row.priority,
        slaStatus: sla.status,
        slaDeadline: sla.deadline,
        hoursRemaining: sla.hoursRemaining,
        createdAt: requestedAt.toISOString(),
      };
    });
  }

  async getRequestDetail(id: string): Promise<ServiceRequestDetailDto> {
    const row = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            slaHours: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            block: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
            phone: true,
          },
        },
        fieldValues: {
          include: {
            field: {
              select: {
                id: true,
                label: true,
                type: true,
              },
            },
          },
          orderBy: { field: { order: 'asc' } },
        },
        comments: {
          include: {
            createdBy: {
              select: {
                id: true,
                nameEN: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    const assignee = row.assignedToId
      ? await this.prisma.user.findUnique({
          where: { id: row.assignedToId },
          select: { id: true, nameEN: true, email: true },
        })
      : null;

    const sla = this.computeSlaInfo({
      requestedAt: this.asDate(row.requestedAt) ?? new Date(),
      status: row.status,
      slaHours: row.service?.slaHours ?? null,
      slaBreachedAt: row.slaBreachedAt,
    });

    return {
      id: row.id,
      requestNumber: this.buildRequestNumber(row.id),
      status: row.status,
      priority: row.priority,
      description: row.description,
      createdAt: this.toIso(row.requestedAt) ?? new Date().toISOString(),
      updatedAt: this.toIso(row.updatedAt) ?? new Date().toISOString(),
      assignedAt: this.toIso(row.assignedAt),
      resolvedAt: this.toIso(row.resolvedAt),
      closedAt: this.toIso(row.closedAt),
      customerRating: row.customerRating,
      internalNotes: row.internalNotes,
      service: {
        id: row.service?.id ?? '',
        name: row.service?.name ?? 'Service Request',
        category: row.service?.category ?? ServiceCategory.OTHER,
        slaHours: row.service?.slaHours ?? null,
      },
      unit: {
        id: row.unit?.id ?? '',
        unitNumber: row.unit?.unitNumber ?? '—',
        block: row.unit?.block ?? null,
      },
      requester: {
        id: row.createdBy.id,
        name: row.createdBy.nameEN ?? row.createdBy.email ?? 'Unknown',
        phone: row.createdBy.phone,
      },
      assignee: assignee
        ? {
            id: assignee.id,
            name: assignee.nameEN ?? assignee.email ?? 'Unknown',
          }
        : null,
      fieldValues: (row.fieldValues ?? []).map((fieldValue) => ({
        fieldId: fieldValue.field.id,
        label: fieldValue.field.label,
        type: fieldValue.field.type,
        valueText: fieldValue.valueText,
        valueNumber: fieldValue.valueNumber,
        valueBool: fieldValue.valueBool,
        valueDate: this.toIso(fieldValue.valueDate),
        fileAttachmentId: fieldValue.fileAttachmentId,
      })),
      comments: (row.comments ?? []).map((comment) => this.mapComment(comment)),
      invoices: (row.invoices ?? []).map((invoice) => this.mapInvoice(invoice)),
      sla,
    };
  }

  async assignRequest(
    id: string,
    dto: AssignRequestDto,
    _adminId: string,
  ): Promise<ServiceRequestDetailDto> {
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true },
    });

    if (!assignee) {
      throw new BadRequestException('Assigned To ID is invalid.');
    }

    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        assignedToId: true,
        status: true,
      },
    });
    if (!request) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    const shouldMoveToInProgress = request.status === ServiceRequestStatus.NEW;

    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        assignedToId: dto.assignedToId,
        assignedAt: request.assignedToId ? undefined : new Date(),
        ...(shouldMoveToInProgress ? { status: ServiceRequestStatus.IN_PROGRESS } : {}),
      },
    });

    return this.getRequestDetail(id);
  }

  async updateRequestStatus(
    id: string,
    dto: UpdateRequestStatusDto,
    allowTransitionFromInlineAssign = false,
  ): Promise<ServiceRequestDetailDto> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedToId: true,
        internalNotes: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    if (request.status === dto.status) {
      return this.getRequestDetail(id);
    }

    const now = new Date();
    const updateData: Prisma.ServiceRequestUpdateInput = {
      status: dto.status,
    };

    const validTransition =
      dto.status === ServiceRequestStatus.CANCELLED ||
      (request.status === ServiceRequestStatus.NEW &&
        dto.status === ServiceRequestStatus.IN_PROGRESS) ||
      (request.status === ServiceRequestStatus.IN_PROGRESS &&
        dto.status === ServiceRequestStatus.RESOLVED) ||
      (request.status === ServiceRequestStatus.RESOLVED &&
        dto.status === ServiceRequestStatus.CLOSED);

    if (!validTransition) {
      throw new BadRequestException(
        `Invalid status transition: ${request.status} -> ${dto.status}`,
      );
    }

    if (
      request.status === ServiceRequestStatus.NEW &&
      dto.status === ServiceRequestStatus.IN_PROGRESS &&
      !request.assignedToId &&
      !allowTransitionFromInlineAssign
    ) {
      throw new BadRequestException(
        'Request must be assigned before moving to IN_PROGRESS.',
      );
    }

    if (dto.status === ServiceRequestStatus.RESOLVED) {
      updateData.resolvedAt = now;
    }
    if (
      dto.status === ServiceRequestStatus.CLOSED ||
      dto.status === ServiceRequestStatus.CANCELLED
    ) {
      updateData.closedAt = now;
    }

    if (dto.notes?.trim()) {
      updateData.internalNotes = this.appendInternalNote(
        request.internalNotes,
        dto.notes,
        'system',
      );
    }

    await this.prisma.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    return this.getRequestDetail(id);
  }

  async addInternalNote(
    id: string,
    note: string,
    adminId: string,
  ): Promise<ServiceRequestDetailDto> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        internalNotes: true,
      },
    });
    if (!request) {
      throw new NotFoundException(`Service Request with ID ${id} not found.`);
    }

    await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        internalNotes: this.appendInternalNote(request.internalNotes, note, adminId),
      },
    });

    return this.getRequestDetail(id);
  }

  async checkSlaBreaches(): Promise<number> {
    const now = new Date();
    const openRequests = await this.prisma.serviceRequest.findMany({
      where: {
        status: {
          in: [ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS],
        },
        slaBreachedAt: null,
        service: {
          slaHours: {
            not: null,
          },
        },
      },
      select: {
        id: true,
        requestedAt: true,
        service: {
          select: {
            slaHours: true,
          },
        },
      },
    });

    const breachedIds = openRequests
      .filter((request) => {
        const slaHours = request.service.slaHours;
        if (!slaHours) return false;
        const deadline = new Date(
          request.requestedAt.getTime() + slaHours * 60 * 60 * 1000,
        );
        return deadline < now;
      })
      .map((request) => request.id);

    if (breachedIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: { in: breachedIds },
        slaBreachedAt: null,
      },
      data: {
        slaBreachedAt: now,
      },
    });

    return result.count;
  }

  async submitRating(
    requestId: string,
    userId: string,
    dto: SubmitRatingDto,
  ): Promise<ServiceRequestDetailDto> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        createdById: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Service Request with ID ${requestId} not found.`);
    }

    if (request.createdById !== userId) {
      throw new ForbiddenException('Only the original requester can submit a rating.');
    }

    if (
      request.status !== ServiceRequestStatus.RESOLVED &&
      request.status !== ServiceRequestStatus.CLOSED
    ) {
      throw new BadRequestException(
        'Rating can only be submitted after the request is resolved or closed.',
      );
    }

    await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { customerRating: dto.rating },
    });

    return this.getRequestDetail(requestId);
  }

  // Backward-compatible list endpoints
  async findAll(kind: 'services' | 'requests' | 'all' = 'all'): Promise<ServiceRequestListItemDto[]> {
    const rows = await this.listRequests({});
    const categoryFilter = this.normalizeCategoryFilter(kind);
    if (!categoryFilter) return rows;

    return rows.filter((row) => {
      if (categoryFilter.in) {
        return categoryFilter.in.includes(row.category);
      }
      if (categoryFilter.notIn) {
        return !categoryFilter.notIn.includes(row.category);
      }
      return true;
    });
  }

  async findByUser(
    userId: string,
    kind: 'services' | 'requests' | 'all' = 'all',
  ): Promise<ServiceRequestListItemDto[]> {
    const rows = await this.listRequests({ createdById: userId });
    const categoryFilter = this.normalizeCategoryFilter(kind);
    if (!categoryFilter) return rows;

    return rows.filter((row) => {
      if (categoryFilter.in) {
        return categoryFilter.in.includes(row.category);
      }
      if (categoryFilter.notIn) {
        return !categoryFilter.notIn.includes(row.category);
      }
      return true;
    });
  }

  async findOne(id: string): Promise<ServiceRequestDetailDto> {
    return this.getRequestDetail(id);
  }

  async findOneForActor(id: string, ctx: ActorContext): Promise<ServiceRequestDetailDto> {
    const request = await this.getRequestDetail(id);
    if (this.canViewAllRequests(ctx)) {
      return request;
    }

    if (request.requester.id !== ctx.actorUserId) {
      throw new ForbiddenException('You do not have access to this service request');
    }

    return request;
  }

  async updateForActor(
    id: string,
    dto: UpdateServiceRequestInternalDto,
    ctx: ActorContext,
  ): Promise<ServiceRequestDetailDto> {
    const canAssign =
      isSuperAdminRole(ctx.roles) || ctx.permissions.includes('service_request.assign');
    const canResolve =
      isSuperAdminRole(ctx.roles) || ctx.permissions.includes('service_request.resolve');
    const canClose =
      isSuperAdminRole(ctx.roles) || ctx.permissions.includes('service_request.close');

    let current = await this.findOneForActor(id, ctx);

    if (dto.assignedToId) {
      if (!canAssign) {
        throw new ForbiddenException(
          'You do not have permission to assign service requests',
        );
      }
      current = await this.assignRequest(id, { assignedToId: dto.assignedToId }, ctx.actorUserId);
    }

    if (dto.status) {
      if (
        dto.status === ServiceRequestStatus.RESOLVED &&
        !canResolve
      ) {
        throw new ForbiddenException(
          'You do not have permission to resolve service requests',
        );
      }

      if (
        (dto.status === ServiceRequestStatus.CLOSED ||
          dto.status === ServiceRequestStatus.CANCELLED) &&
        !canClose
      ) {
        throw new ForbiddenException(
          'You do not have permission to close service requests',
        );
      }

      if (
        (dto.status === ServiceRequestStatus.NEW ||
          dto.status === ServiceRequestStatus.IN_PROGRESS) &&
        !canAssign
      ) {
        throw new ForbiddenException(
          'You do not have permission to update service request status',
        );
      }

      current = await this.updateRequestStatus(id, {
        status: dto.status,
        notes: dto.notes,
      }, Boolean(dto.assignedToId));
    } else if (dto.notes?.trim()) {
      current = await this.addInternalNote(id, dto.notes, ctx.actorUserId);
    }

    return current;
  }

  async listCommentsForActor(
    id: string,
    ctx: ActorContext,
  ): Promise<ServiceRequestCommentResponseDto[]> {
    const canViewAll = this.canViewAllRequests(ctx);
    const request = await this.findOneForActor(id, ctx);

    const comments = await this.prisma.serviceRequestComment.findMany({
      where: {
        requestId: request.id,
        ...(canViewAll ? {} : { isInternal: false }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment) => this.mapComment(comment));
  }

  async addCommentForActor(
    id: string,
    dto: CreateServiceRequestCommentDto,
    ctx: ActorContext,
  ): Promise<ServiceRequestCommentResponseDto> {
    const canViewAll = this.canViewAllRequests(ctx);
    const request = await this.findOneForActor(id, ctx);

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
          select: {
            id: true,
            nameEN: true,
            email: true,
          },
        },
      },
    });

    return this.mapComment(comment);
  }

  async cancelForActor(
    id: string,
    dto: CancelServiceRequestDto,
    ctx: ActorContext,
  ): Promise<ServiceRequestDetailDto> {
    const request = await this.findOneForActor(id, ctx);

    if (request.requester.id !== ctx.actorUserId) {
      throw new ForbiddenException('Only the requester can cancel this ticket');
    }

    if (request.status !== ServiceRequestStatus.NEW) {
      throw new BadRequestException(
        'This request can no longer be cancelled because it is already under review or completed.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { id: request.id },
        data: {
          status: ServiceRequestStatus.CANCELLED,
          closedAt: new Date(),
        },
      });

      const reason = dto.reason?.trim();
      await tx.serviceRequestComment.create({
        data: {
          requestId: request.id,
          createdById: ctx.actorUserId,
          body: reason ? `Cancelled by owner: ${reason}` : 'Cancelled by owner',
          isInternal: false,
        },
      });
    });

    return this.getRequestDetail(id);
  }
}
