import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ServiceCategory,
  ServiceRequestStatus,
  type ServiceField,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import {
  ServiceDetailResponseDto,
  ServiceFieldResponseDto,
  ServiceListItemDto,
  ServiceStatsResponseDto,
} from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private monthBounds(now = new Date()): { start: Date; end: Date } {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined): number {
    if (!value) return 0;
    return Number(value.toString());
  }

  private mapField(row: ServiceField): ServiceFieldResponseDto {
    return {
      id: row.id,
      label: row.label,
      type: row.type,
      placeholder: row.placeholder,
      required: row.required,
      order: row.order ?? 0,
    };
  }

  private mapListItem(row: {
    id: string;
    name: string;
    category: ServiceCategory;
    status: boolean;
    description: string | null;
    slaHours: number | null;
    startingPrice: Prisma.Decimal | null;
    revenueTotal: Prisma.Decimal;
    iconName: string | null;
    iconTone: string;
    isUrgent: boolean;
    assignedRole: { name: string } | null;
    _count: { requests: number; microServices?: number };
  }): ServiceListItemDto {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      status: row.status,
      description: row.description,
      slaHours: row.slaHours,
      startingPrice: row.startingPrice
        ? this.decimalToNumber(row.startingPrice)
        : null,
      assignedRoleName: row.assignedRole?.name ?? null,
      totalRequestsCount: row._count.requests,
      microServicesCount: row._count.microServices ?? 0,
      revenueTotal: this.decimalToNumber(row.revenueTotal),
      iconName: row.iconName,
      iconTone: row.iconTone,
      isUrgent: row.isUrgent,
    };
  }

  private async ensureRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) {
      throw new BadRequestException('Assigned role not found.');
    }
  }

  private buildStatusFilter(status?: 'active' | 'inactive' | 'all'): boolean | undefined {
    if (!status || status === 'all') return undefined;
    return status === 'active';
  }

  async listServices(filters: ListServicesQueryDto = {}): Promise<ServiceListItemDto[]> {
    const where: Prisma.ServiceWhereInput = {};

    const statusFilter = this.buildStatusFilter(filters.status);
    if (statusFilter !== undefined) {
      where.status = statusFilter;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.service.findMany({
      where,
      include: {
        assignedRole: { select: { name: true } },
        _count: { select: { requests: true, microServices: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.mapListItem(row));
  }

  async getServiceDetail(id: string): Promise<ServiceDetailResponseDto> {
    const row = await this.prisma.service.findUnique({
      where: { id },
      include: {
        formFields: {
          orderBy: { order: 'asc' },
        },
        assignedRole: { select: { id: true, name: true } },
        microServices: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        requests: {
          select: {
            id: true,
            status: true,
            requestedAt: true,
            resolvedAt: true,
            slaBreachedAt: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    const { start, end } = this.monthBounds();
    const totalRequests = row.requests.length;
    const openRequests = row.requests.filter(
      (request) =>
        request.status === ServiceRequestStatus.NEW ||
        request.status === ServiceRequestStatus.IN_PROGRESS,
    ).length;

    const resolvedThisMonth = row.requests.filter(
      (request) =>
        request.resolvedAt !== null &&
        request.resolvedAt >= start &&
        request.resolvedAt < end,
    ).length;

    const resolvedDurationsHours = row.requests
      .filter((request) => request.resolvedAt !== null)
      .map((request) => {
        const resolvedAt = request.resolvedAt as Date;
        return (
          (resolvedAt.getTime() - request.requestedAt.getTime()) /
          (1000 * 60 * 60)
        );
      });

    const avgResolutionHours =
      resolvedDurationsHours.length > 0
        ? Number(
            (
              resolvedDurationsHours.reduce((sum, value) => sum + value, 0) /
              resolvedDurationsHours.length
            ).toFixed(2),
          )
        : 0;

    const breachedCount = row.requests.filter(
      (request) => request.slaBreachedAt !== null,
    ).length;

    const slaBreachRate =
      totalRequests > 0
        ? Number(((breachedCount / totalRequests) * 100).toFixed(2))
        : 0;

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      status: row.status,
      unitEligibility: row.unitEligibility,
      processingTime: row.processingTime,
      description: row.description,
      slaHours: row.slaHours,
      startingPrice: row.startingPrice
        ? this.decimalToNumber(row.startingPrice)
        : null,
      assignedRoleId: row.assignedRoleId,
      assignedRoleName: row.assignedRole?.name ?? null,
      isUrgent: row.isUrgent,
      iconName: row.iconName,
      iconTone: row.iconTone,
      fields: row.formFields.map((field) => this.mapField(field)),
      microServices: (row as any).microServices?.map((ms: any) => ({
        id: ms.id,
        name: ms.name,
        description: ms.description,
        price: ms.price ? this.decimalToNumber(ms.price) : null,
        isActive: ms.isActive,
        displayOrder: ms.displayOrder,
      })) ?? [],
      stats: {
        totalRequests,
        openRequests,
        resolvedThisMonth,
        avgResolutionHours,
        slaBreachRate,
        revenueTotal: this.decimalToNumber(row.revenueTotal),
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateServiceDto): Promise<ServiceDetailResponseDto> {
    if (dto.assignedRoleId) {
      await this.ensureRoleExists(dto.assignedRoleId);
    }

    const displayOrder =
      dto.displayOrder ??
      ((await this.prisma.service.aggregate({ _max: { displayOrder: true } }))._max
        .displayOrder ?? 0) + 1;

    const service = await this.prisma.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          name: dto.name,
          category: dto.category,
          displayOrder,
          iconName: dto.iconName,
          iconTone: dto.iconTone,
          unitEligibility: dto.unitEligibility,
          processingTime: dto.processingTime,
          description: dto.description,
          status: dto.status,
          isUrgent: dto.isUrgent,
          startingPrice: dto.startingPrice,
          slaHours: dto.slaHours,
          assignedRoleId: dto.assignedRoleId,
        },
      });

      if (dto.fields?.length) {
        await tx.serviceField.createMany({
          data: dto.fields.map((field, index) => ({
            serviceId: created.id,
            label: field.label,
            type: field.type,
            placeholder: field.placeholder,
            required: field.required ?? false,
            order: field.order ?? index + 1,
          })),
        });
      }

      if (dto.microServices?.length) {
        await tx.microService.createMany({
          data: dto.microServices.map((ms, index) => ({
            serviceId: created.id,
            name: ms.name.trim(),
            description: ms.description?.trim() || null,
            price: ms.price ?? null,
            isActive: ms.isActive ?? true,
            displayOrder: ms.displayOrder ?? index + 1,
          })),
        });
      }

      return created;
    });

    return this.getServiceDetail(service.id);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceDetailResponseDto> {
    const existing = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    if (dto.assignedRoleId) {
      await this.ensureRoleExists(dto.assignedRoleId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          displayOrder: dto.displayOrder,
          iconName: dto.iconName,
          iconTone: dto.iconTone,
          unitEligibility: dto.unitEligibility,
          processingTime: dto.processingTime,
          description: dto.description,
          status: dto.status,
          isUrgent: dto.isUrgent,
          startingPrice: dto.startingPrice,
          slaHours: dto.slaHours,
          assignedRoleId: dto.assignedRoleId,
        },
      });

      if (dto.fields) {
        await tx.serviceField.deleteMany({ where: { serviceId: id } });

        if (dto.fields.length > 0) {
          await tx.serviceField.createMany({
            data: dto.fields.map((field, index) => ({
              serviceId: id,
              label: field.label,
              type: field.type,
              placeholder: field.placeholder,
              required: field.required ?? false,
              order: field.order ?? index + 1,
            })),
          });
        }
      }

      if (dto.microServices) {
        await tx.microService.deleteMany({ where: { serviceId: id } });

        if (dto.microServices.length > 0) {
          await tx.microService.createMany({
            data: dto.microServices.map((ms, index) => ({
              serviceId: id,
              name: ms.name.trim(),
              description: ms.description?.trim() || null,
              price: ms.price ?? null,
              isActive: ms.isActive ?? true,
              displayOrder: ms.displayOrder ?? index + 1,
            })),
          });
        }
      }
    });

    return this.getServiceDetail(id);
  }

  async toggleService(id: string): Promise<{ id: string; status: boolean }> {
    const row = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!row) {
      throw new NotFoundException(`Service with ID ${id} not found.`);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: { status: !row.status },
      select: { id: true, status: true },
    });

    return updated;
  }

  async getServiceStats(): Promise<ServiceStatsResponseDto> {
    const { start, end } = this.monthBounds();

    const [
      totalServices,
      activeServices,
      totalRequests,
      openRequests,
      slaBreachedRequests,
      resolvedThisMonth,
      services,
      requests,
    ] = await Promise.all([
      this.prisma.service.count(),
      this.prisma.service.count({ where: { status: true } }),
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({
        where: {
          status: {
            in: [ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.serviceRequest.count({
        where: {
          slaBreachedAt: { not: null },
          status: {
            in: [ServiceRequestStatus.NEW, ServiceRequestStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.serviceRequest.count({
        where: {
          resolvedAt: {
            gte: start,
            lt: end,
          },
        },
      }),
      this.prisma.service.findMany({ select: { revenueTotal: true } }),
      this.prisma.serviceRequest.findMany({
        select: {
          service: {
            select: {
              category: true,
            },
          },
        },
      }),
    ]);

    const requestsByCategory = Object.values(ServiceCategory).reduce(
      (acc, category) => {
        acc[category] = 0;
        return acc;
      },
      {} as Record<ServiceCategory, number>,
    );

    for (const request of requests) {
      requestsByCategory[request.service.category] += 1;
    }

    const totalRevenue = Number(
      services
        .reduce((sum, service) => sum + this.decimalToNumber(service.revenueTotal), 0)
        .toFixed(2),
    );

    return {
      totalServices,
      activeServices,
      totalRequests,
      openRequests,
      slaBreachedRequests,
      resolvedThisMonth,
      totalRevenue,
      requestsByCategory,
    };
  }

  async remove(id: string): Promise<{ success: true }> {
    const existingRequests = await this.prisma.serviceRequest.count({
      where: { serviceId: id },
    });
    if (existingRequests > 0) {
      throw new BadRequestException(
        'Cannot delete service: there are existing requests linked. Set status to false instead.',
      );
    }

    await this.prisma.service.delete({ where: { id } });
    return { success: true };
  }

  async reorder(ids: string[]): Promise<{ success: true; updated: number }> {
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
      uniqueIds.map((rowId, index) =>
        this.prisma.service.update({
          where: { id: rowId },
          data: { displayOrder: index + 1 },
        }),
      ),
    );

    return { success: true, updated: uniqueIds.length };
  }

  // Backward-compatible wrappers
  async findAll(
    status: boolean | undefined,
    _isUrgent: boolean | undefined = undefined,
    category?: string,
    _kind: 'services' | 'requests' | 'all' = 'all',
  ): Promise<ServiceListItemDto[]> {
    const query: ListServicesQueryDto = {
      status: status === undefined ? 'all' : status ? 'active' : 'inactive',
      category:
        category && Object.values(ServiceCategory).includes(category.toUpperCase() as ServiceCategory)
          ? (category.toUpperCase() as ServiceCategory)
          : undefined,
    };
    return this.listServices(query);
  }

  async findOne(id: string): Promise<ServiceDetailResponseDto> {
    return this.getServiceDetail(id);
  }
}

