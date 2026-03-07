import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Audience,
  Channel,
  NotificationType,
  PermitCategory,
  PermitStatus,
  Prisma,
  ServiceFieldType,
  type PermitField,
  type PermitType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { CreatePermitFieldDto } from './dto/create-permit-field.dto';
import {
  CreatePermitRequestDto,
  PermitFieldValueInputDto,
} from './dto/create-permit-request.dto';
import { CreatePermitTypeDto } from './dto/create-permit-type.dto';
import { ListPermitRequestsQueryDto } from './dto/list-permit-requests-query.dto';
import {
  PermitFieldResponseDto,
  PermitRequestDetailDto,
  PermitRequestListItemDto,
  PermitStatsResponseDto,
  PermitTypeResponseDto,
} from './dto/permit-response.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';
import { UpdatePermitTypeDto } from './dto/update-permit-type.dto';

@Injectable()
export class PermitsService {
  private readonly logger = new Logger(PermitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private monthBounds(now = new Date()): { start: Date; end: Date } {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  private mapField(field: PermitField): PermitFieldResponseDto {
    return {
      id: field.id,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder,
      required: field.required,
      displayOrder: field.displayOrder,
    };
  }

  private mapPermitType(
    row: PermitType & { fields: PermitField[] },
  ): PermitTypeResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      fields: row.fields
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((field) => this.mapField(field)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(
    baseName: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.slugify(baseName);
    if (!baseSlug) {
      throw new BadRequestException('Unable to generate slug from permit type name.');
    }

    let candidate = baseSlug;
    let index = 1;

    while (true) {
      const existing = await this.prisma.permitType.findFirst({
        where: {
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      index += 1;
      candidate = `${baseSlug}-${index}`;
    }
  }

  private async generateRequestNumberTx(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    await tx.permitRequestSequence.upsert({
      where: { name: 'permits' },
      update: {},
      create: { name: 'permits', counter: BigInt(0) },
    });

    const updated = await tx.permitRequestSequence.update({
      where: { name: 'permits' },
      data: {
        counter: { increment: BigInt(1) },
      },
    });

    return `PRM-${updated.counter.toString().padStart(6, '0')}`;
  }

  private normalizeFieldValue(
    field: PermitField,
    payload: PermitFieldValueInputDto,
  ): {
    valueText?: string;
    valueNumber?: number;
    valueBool?: boolean;
    valueDate?: Date;
  } {
    const { value } = payload;

    switch (field.type) {
      case ServiceFieldType.TEXT:
      case ServiceFieldType.TEXTAREA:
      case ServiceFieldType.MEMBER_SELECTOR:
      case ServiceFieldType.FILE: {
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new BadRequestException(
            `Field "${field.label}" expects a non-empty string value.`,
          );
        }
        return { valueText: value.trim() };
      }
      case ServiceFieldType.NUMBER: {
        const numberValue =
          typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number(value)
              : Number.NaN;
        if (!Number.isFinite(numberValue)) {
          throw new BadRequestException(
            `Field "${field.label}" expects a numeric value.`,
          );
        }
        return { valueNumber: numberValue };
      }
      case ServiceFieldType.BOOLEAN: {
        if (typeof value === 'boolean') {
          return { valueBool: value };
        }
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
            return { valueBool: true };
          }
          if (normalized === 'false' || normalized === '0' || normalized === 'no') {
            return { valueBool: false };
          }
        }
        throw new BadRequestException(
          `Field "${field.label}" expects a boolean value.`,
        );
      }
      case ServiceFieldType.DATE: {
        const dateValue =
          typeof value === 'string' || typeof value === 'number'
            ? new Date(value)
            : null;
        if (!dateValue || Number.isNaN(dateValue.getTime())) {
          throw new BadRequestException(
            `Field "${field.label}" expects a valid date value.`,
          );
        }
        return { valueDate: dateValue };
      }
      default:
        throw new BadRequestException(
          `Unsupported field type "${field.type}" for "${field.label}".`,
        );
    }
  }

  private async validateRequestPayload(
    permitTypeId: string,
    fieldValues: PermitFieldValueInputDto[],
  ): Promise<PermitField[]> {
    const permitType = await this.prisma.permitType.findUnique({
      where: { id: permitTypeId },
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!permitType) {
      throw new NotFoundException(`Permit type with ID ${permitTypeId} not found.`);
    }

    if (!permitType.isActive) {
      throw new BadRequestException('Permit type is inactive.');
    }

    const fieldsById = new Map(permitType.fields.map((field) => [field.id, field]));
    const submittedIds = fieldValues.map((row) => row.fieldId);

    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('Duplicate fieldId entries are not allowed.');
    }

    const invalidFieldIds = submittedIds.filter((fieldId) => !fieldsById.has(fieldId));
    if (invalidFieldIds.length > 0) {
      throw new BadRequestException(
        `Invalid field IDs for permit type: ${invalidFieldIds.join(', ')}`,
      );
    }

    const missingRequired = permitType.fields.filter(
      (field) => field.required && !submittedIds.includes(field.id),
    );
    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missingRequired
          .map((field) => field.label)
          .join(', ')}`,
      );
    }

    return permitType.fields;
  }

  async listPermitTypes(includeInactive = false): Promise<PermitTypeResponseDto[]> {
    const rows = await this.prisma.permitType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.mapPermitType(row));
  }

  async getPermitType(idOrSlug: string): Promise<PermitTypeResponseDto> {
    const where: Prisma.PermitTypeWhereInput =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      )
        ? { id: idOrSlug }
        : { slug: idOrSlug };

    const row = await this.prisma.permitType.findFirst({
      where,
      include: {
        fields: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`Permit type ${idOrSlug} not found.`);
    }

    return this.mapPermitType(row);
  }

  async createPermitType(dto: CreatePermitTypeDto): Promise<PermitTypeResponseDto> {
    const slug = await this.generateUniqueSlug(dto.name);
    const displayOrder =
      (await this.prisma.permitType.aggregate({ _max: { displayOrder: true } }))._max
        .displayOrder ?? 0;

    const created = await this.prisma.$transaction(async (tx) => {
      const permitType = await tx.permitType.create({
        data: {
          name: dto.name.trim(),
          slug,
          category: dto.category,
          description: dto.description?.trim() || null,
          displayOrder: displayOrder + 1,
        },
        include: {
          fields: true,
        },
      });

      if (dto.fields?.length) {
        await tx.permitField.createMany({
          data: dto.fields.map((field, index) => ({
            permitTypeId: permitType.id,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder,
            required: field.required ?? false,
            displayOrder: field.displayOrder ?? index + 1,
          })),
        });
      }

      return permitType.id;
    });

    return this.getPermitType(created);
  }

  async updatePermitType(
    id: string,
    dto: UpdatePermitTypeDto,
  ): Promise<PermitTypeResponseDto> {
    const existing = await this.prisma.permitType.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException(`Permit type with ID ${id} not found.`);
    }

    const slug = dto.name
      ? await this.generateUniqueSlug(dto.name, id)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.permitType.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug,
          category: dto.category,
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
        },
      });

      if (dto.fields) {
        await tx.permitField.deleteMany({ where: { permitTypeId: id } });
        if (dto.fields.length > 0) {
          await tx.permitField.createMany({
            data: dto.fields.map((field, index) => ({
              permitTypeId: id,
              label: field.label,
              type: field.type,
              placeholder: field.placeholder,
              required: field.required ?? false,
              displayOrder: field.displayOrder ?? index + 1,
            })),
          });
        }
      }
    });

    return this.getPermitType(id);
  }

  async togglePermitType(id: string): Promise<{ id: string; isActive: boolean }> {
    const row = await this.prisma.permitType.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`Permit type with ID ${id} not found.`);
    }

    return this.prisma.permitType.update({
      where: { id },
      data: {
        isActive: !row.isActive,
      },
      select: {
        id: true,
        isActive: true,
      },
    });
  }

  async addField(
    permitTypeId: string,
    dto: CreatePermitFieldDto,
  ): Promise<PermitFieldResponseDto> {
    const permitType = await this.prisma.permitType.findUnique({
      where: { id: permitTypeId },
      select: { id: true },
    });
    if (!permitType) {
      throw new NotFoundException(`Permit type with ID ${permitTypeId} not found.`);
    }

    const displayOrder =
      dto.displayOrder ??
      ((await this.prisma.permitField.aggregate({
        where: { permitTypeId },
        _max: { displayOrder: true },
      }))._max.displayOrder ?? 0) + 1;

    const field = await this.prisma.permitField.create({
      data: {
        permitTypeId,
        label: dto.label,
        type: dto.type,
        placeholder: dto.placeholder,
        required: dto.required ?? false,
        displayOrder,
      },
    });

    return this.mapField(field);
  }

  async removeField(fieldId: string): Promise<{ success: true }> {
    const field = await this.prisma.permitField.findUnique({
      where: { id: fieldId },
      select: { id: true },
    });
    if (!field) {
      throw new NotFoundException(`Permit field with ID ${fieldId} not found.`);
    }

    const usedCount = await this.prisma.permitRequestFieldValue.count({
      where: { fieldId },
    });
    if (usedCount > 0) {
      throw new BadRequestException(
        'Cannot remove field because existing requests already use it.',
      );
    }

    await this.prisma.permitField.delete({ where: { id: fieldId } });
    return { success: true };
  }

  async createPermitRequest(
    requesterId: string,
    dto: CreatePermitRequestDto,
  ): Promise<PermitRequestDetailDto> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${dto.unitId} not found.`);
    }

    await getActiveUnitAccess(this.prisma, requesterId, dto.unitId);

    const permitFields = await this.validateRequestPayload(
      dto.permitTypeId,
      dto.fieldValues,
    );
    const fieldsById = new Map(permitFields.map((field) => [field.id, field]));

    const requestId = await this.prisma.$transaction(async (tx) => {
      const requestNumber = await this.generateRequestNumberTx(tx);

      const request = await tx.permitRequest.create({
        data: {
          requestNumber,
          permitTypeId: dto.permitTypeId,
          unitId: dto.unitId,
          requestedById: requesterId,
          notes: dto.notes?.trim() || null,
        },
        select: { id: true },
      });

      await tx.permitRequestFieldValue.createMany({
        data: dto.fieldValues.map((fieldValue) => {
          const field = fieldsById.get(fieldValue.fieldId);
          if (!field) {
            throw new BadRequestException(
              `Field ${fieldValue.fieldId} does not belong to this permit type.`,
            );
          }
          const normalized = this.normalizeFieldValue(field, fieldValue);
          return {
            requestId: request.id,
            fieldId: field.id,
            valueText: normalized.valueText,
            valueNumber: normalized.valueNumber,
            valueBool: normalized.valueBool,
            valueDate: normalized.valueDate,
          };
        }),
      });

      return request.id;
    });

    return this.getPermitRequestDetail(requestId);
  }

  async listPermitRequests(
    filters: ListPermitRequestsQueryDto,
  ): Promise<PermitRequestListItemDto[]> {
    const where: Prisma.PermitRequestWhereInput = {};

    if (filters.permitTypeId) where.permitTypeId = filters.permitTypeId;
    if (filters.status) where.status = filters.status;
    if (filters.unitId) where.unitId = filters.unitId;
    if (filters.requestedById) where.requestedById = filters.requestedById;
    if (filters.category) {
      where.permitType = { category: filters.category };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { permitType: { name: { contains: search, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
        { requestedBy: { nameEN: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.permitRequest.findMany({
      where,
      include: {
        permitType: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      requestNumber: row.requestNumber,
      permitTypeId: row.permitType.id,
      permitTypeName: row.permitType.name,
      category: row.permitType.category,
      unitId: row.unit.id,
      unitNumber: row.unit.unitNumber,
      requesterId: row.requestedBy.id,
      requesterName: row.requestedBy.nameEN ?? row.requestedBy.email ?? 'Unknown',
      status: row.status,
      submittedAt: row.createdAt.toISOString(),
    }));
  }

  async getPermitRequestDetail(id: string): Promise<PermitRequestDetailDto> {
    const row = await this.prisma.permitRequest.findUnique({
      where: { id },
      include: {
        permitType: {
          include: {
            fields: {
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            block: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
            phone: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            nameEN: true,
            email: true,
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
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`Permit request with ID ${id} not found.`);
    }

    return {
      id: row.id,
      requestNumber: row.requestNumber,
      status: row.status,
      notes: row.notes,
      rejectionReason: row.rejectionReason,
      submittedAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      permitType: this.mapPermitType(row.permitType),
      unit: {
        id: row.unit.id,
        unitNumber: row.unit.unitNumber,
        block: row.unit.block,
      },
      requester: {
        id: row.requestedBy.id,
        name: row.requestedBy.nameEN ?? row.requestedBy.email ?? 'Unknown',
        phone: row.requestedBy.phone,
      },
      reviewer: row.reviewedBy
        ? {
            id: row.reviewedBy.id,
            name: row.reviewedBy.nameEN ?? row.reviewedBy.email ?? 'Unknown',
          }
        : null,
      fieldValues: row.fieldValues.map((fieldValue) => ({
        fieldId: fieldValue.field.id,
        label: fieldValue.field.label,
        type: fieldValue.field.type,
        valueText: fieldValue.valueText,
        valueNumber: fieldValue.valueNumber,
        valueBool: fieldValue.valueBool,
        valueDate: fieldValue.valueDate ? fieldValue.valueDate.toISOString() : null,
      })),
    };
  }

  async approveRequest(
    id: string,
    adminId: string,
    dto: ApprovePermitDto,
  ): Promise<PermitRequestDetailDto> {
    const existing = await this.prisma.permitRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        requestNumber: true,
        requestedById: true,
        permitType: { select: { name: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Permit request with ID ${id} not found.`);
    }
    if (existing.status !== PermitStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved.');
    }

    await this.prisma.permitRequest.update({
      where: { id },
      data: {
        status: PermitStatus.APPROVED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: null,
        notes: dto.notes?.trim() || undefined,
      },
    });

    // Notify the requester
    this.notificationsService
      .sendNotification({
        type: NotificationType.ANNOUNCEMENT,
        title: 'Permit Request Approved',
        messageEn: `Your "${existing.permitType.name}" request (${existing.requestNumber}) has been approved.${dto.notes ? ` Note: ${dto.notes.trim()}` : ''}`,
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [existing.requestedById] },
        payload: { route: '#permits', entityType: 'PERMIT_REQUEST', entityId: id },
      })
      .catch((err: unknown) =>
        this.logger.error(`Permit approval notification failed for ${id}`, err),
      );

    return this.getPermitRequestDetail(id);
  }

  async rejectRequest(
    id: string,
    adminId: string,
    dto: RejectPermitDto,
  ): Promise<PermitRequestDetailDto> {
    const existing = await this.prisma.permitRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        requestNumber: true,
        requestedById: true,
        permitType: { select: { name: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Permit request with ID ${id} not found.`);
    }
    if (existing.status !== PermitStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected.');
    }

    await this.prisma.permitRequest.update({
      where: { id },
      data: {
        status: PermitStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: dto.reason.trim(),
      },
    });

    // Notify the requester
    this.notificationsService
      .sendNotification({
        type: NotificationType.ANNOUNCEMENT,
        title: 'Permit Request Rejected',
        messageEn: `Your "${existing.permitType.name}" request (${existing.requestNumber}) was not approved. Reason: ${dto.reason.trim()}`,
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [existing.requestedById] },
        payload: { route: '#permits', entityType: 'PERMIT_REQUEST', entityId: id },
      })
      .catch((err: unknown) =>
        this.logger.error(`Permit rejection notification failed for ${id}`, err),
      );

    return this.getPermitRequestDetail(id);
  }

  async getPermitStats(): Promise<PermitStatsResponseDto> {
    const rows = await this.prisma.permitRequest.findMany({
      select: {
        status: true,
        reviewedAt: true,
        permitType: {
          select: {
            category: true,
          },
        },
      },
    });

    const { start, end } = this.monthBounds();

    const requestsByCategory = Object.values(PermitCategory).reduce(
      (acc, category) => {
        acc[category] = 0;
        return acc;
      },
      {} as Record<PermitCategory, number>,
    );

    const requestsByStatus = Object.values(PermitStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<PermitStatus, number>,
    );

    let approvedThisMonth = 0;
    let rejectedThisMonth = 0;

    for (const row of rows) {
      requestsByCategory[row.permitType.category] += 1;
      requestsByStatus[row.status] += 1;

      if (row.status === PermitStatus.APPROVED && row.reviewedAt) {
        if (row.reviewedAt >= start && row.reviewedAt < end) {
          approvedThisMonth += 1;
        }
      }

      if (row.status === PermitStatus.REJECTED && row.reviewedAt) {
        if (row.reviewedAt >= start && row.reviewedAt < end) {
          rejectedThisMonth += 1;
        }
      }
    }

    return {
      totalRequests: rows.length,
      pendingRequests: requestsByStatus[PermitStatus.PENDING],
      approvedThisMonth,
      rejectedThisMonth,
      requestsByCategory,
      requestsByStatus,
    };
  }
}
