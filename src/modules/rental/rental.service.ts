import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessStatus,
  LeaseSource,
  LeaseStatus,
  Prisma,
  RentRequestStatus,
  UnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RentRequestsService } from '../rent-requests/rent-requests.service';
import { ListLeasesDto } from './dto/list-leases.dto';
import { ListRentRequestsDto } from './dto/list-rent-requests.dto';
import { RejectRentRequestDto } from './dto/reject-rent-request.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import {
  LeaseDetailResponseDto,
  LeaseInvoiceHistoryItemDto,
  LeaseListItemDto,
  LeasePersonSummaryDto,
  LeaseRenewalLinkDto,
  LeaseUnitSummaryDto,
  PaginatedRentRequestsResponseDto,
  RentRequestListItemDto,
  RentalSettingsResponseDto,
  RentalStatsResponseDto,
} from './dto/rental-response.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { ToggleLeasingDto } from './dto/toggle-leasing.dto';

type RentalSettingsState = {
  leasingEnabled: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  suspendedById: string | null;
};

const RENTAL_SETTINGS_SECTION = 'rental_settings';
const DEFAULT_RENTAL_SETTINGS: RentalSettingsState = {
  leasingEnabled: true,
  suspensionReason: null,
  suspendedAt: null,
  suspendedById: null,
};

type RenewalLinkRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: LeaseStatus;
  renewedFromId: string | null;
  renewedToId: string | null;
};

@Injectable()
export class RentalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rentRequestsService: RentRequestsService,
  ) {}

  async getRentalSettings(_communityId?: string): Promise<RentalSettingsResponseDto> {
    const settings = await this.getRentalSettingsState();
    return {
      leasingEnabled: settings.leasingEnabled,
      suspensionReason: settings.suspensionReason,
      suspendedAt: settings.suspendedAt,
    };
  }

  async toggleLeasingOperations(
    dto: ToggleLeasingDto,
    adminId: string,
  ): Promise<RentalSettingsResponseDto> {
    const now = new Date();

    if (!dto.enabled && !String(dto.reason ?? '').trim()) {
      throw new BadRequestException('reason is required when disabling leasing');
    }

    const value: RentalSettingsState = dto.enabled
      ? {
          leasingEnabled: true,
          suspensionReason: null,
          suspendedAt: null,
          suspendedById: null,
        }
      : {
          leasingEnabled: false,
          suspensionReason: String(dto.reason).trim(),
          suspendedAt: now.toISOString(),
          suspendedById: adminId,
        };

    await this.prisma.systemSetting.upsert({
      where: { section: RENTAL_SETTINGS_SECTION },
      create: {
        section: RENTAL_SETTINGS_SECTION,
        value: value as unknown as Prisma.InputJsonValue,
        updatedById: adminId,
      },
      update: {
        value: value as unknown as Prisma.InputJsonValue,
        updatedById: adminId,
      },
    });

    return {
      leasingEnabled: value.leasingEnabled,
      suspensionReason: value.suspensionReason,
      suspendedAt: value.suspendedAt,
    };
  }

  async listLeases(filters: ListLeasesDto): Promise<LeaseListItemDto[]> {
    const now = new Date();
    const where: Prisma.LeaseWhereInput = {
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters.communityId
        ? {
            unit: {
              communityId: filters.communityId,
            },
          }
        : {}),
    };

    if (filters.search) {
      const search = filters.search.trim();
      if (search.length > 0) {
        where.OR = [
          { unit: { unitNumber: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { tenant: { nameEN: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { owner: { nameEN: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ];
      }
    }

    if (filters.expiringWithinDays) {
      const windowEnd = new Date(now.getTime() + filters.expiringWithinDays * 24 * 60 * 60 * 1000);
      where.status = LeaseStatus.ACTIVE;
      where.endDate = {
        gte: now,
        lte: windowEnd,
      };
    }

    const rows = await this.prisma.lease.findMany({
      where,
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
            community: {
              select: { name: true },
            },
          },
        },
        owner: {
          select: {
            nameEN: true,
          },
        },
        tenant: {
          select: {
            nameEN: true,
          },
        },
      },
      orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      unitNumber: row.unit.unitNumber,
      communityName: row.unit.community?.name ?? row.unit.projectName,
      ownerName: row.owner.nameEN ?? row.ownerId,
      tenantName: row.tenant?.nameEN ?? null,
      monthlyRent: this.decimalToNumber(row.monthlyRent),
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      status: row.status,
      daysUntilExpiry: this.calculateDaysUntilExpiry(row.endDate, row.status, now),
      source: row.source,
    }));
  }

  async getLeaseDetail(id: string): Promise<LeaseDetailResponseDto> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        unit: {
          include: {
            community: {
              select: {
                name: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            nameEN: true,
            email: true,
            phone: true,
          },
        },
        tenant: {
          select: {
            id: true,
            nameEN: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const [renewedFrom, renewedTo, renewalChain, invoiceHistory] = await Promise.all([
      this.fetchRenewalLink(lease.renewedFromId),
      this.fetchRenewalLink(lease.renewedToId),
      this.buildRenewalChain(lease),
      this.listLeaseInvoices(lease.id, lease.unitId, lease.tenantId, lease.startDate, lease.endDate),
    ]);

    return {
      id: lease.id,
      status: lease.status,
      source: lease.source,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate.toISOString(),
      monthlyRent: this.decimalToNumber(lease.monthlyRent),
      securityDeposit: this.decimalToNullableNumber(lease.securityDeposit),
      autoRenew: lease.autoRenew,
      renewalNoticeSentAt: lease.renewalNoticeSentAt
        ? lease.renewalNoticeSentAt.toISOString()
        : null,
      unit: this.mapLeaseUnit(lease.unit),
      owner: this.mapLeasePerson(lease.owner),
      tenant: lease.tenant ? this.mapLeasePerson(lease.tenant) : null,
      renewedFrom,
      renewedTo,
      renewalChain,
      invoiceHistory,
    };
  }

  async renewLease(
    id: string,
    dto: RenewLeaseDto,
    adminId: string,
  ): Promise<LeaseDetailResponseDto> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid renewal dates');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const existing = await this.prisma.lease.findUnique({
      where: { id },
      select: {
        id: true,
        unitId: true,
        ownerId: true,
        tenantId: true,
        tenantEmail: true,
        tenantNationalId: true,
        securityDeposit: true,
        source: true,
        status: true,
        renewedToId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Lease not found');
    }
    if (existing.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE leases can be renewed');
    }
    if (existing.renewedToId) {
      throw new ConflictException('Lease is already renewed');
    }

    const overlappingLease = await this.prisma.lease.findFirst({
      where: {
        unitId: existing.unitId,
        status: LeaseStatus.ACTIVE,
        id: { not: existing.id },
        OR: [
          {
            startDate: { lte: startDate },
            endDate: { gte: startDate },
          },
          {
            startDate: { lte: endDate },
            endDate: { gte: endDate },
          },
          {
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
        ],
      },
      select: { id: true },
    });

    if (overlappingLease) {
      throw new ConflictException('Another active lease overlaps the requested renewal period');
    }

    const renewedLease = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lease.create({
        data: {
          unitId: existing.unitId,
          ownerId: existing.ownerId,
          tenantId: existing.tenantId,
          tenantEmail: existing.tenantEmail,
          tenantNationalId: existing.tenantNationalId,
          startDate,
          endDate,
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
          securityDeposit: existing.securityDeposit,
          status: LeaseStatus.ACTIVE,
          source: existing.source ?? LeaseSource.OWNER,
          renewedFromId: existing.id,
          autoRenew: dto.autoRenew ?? false,
          contractFileId: null,
        },
        select: { id: true },
      });

      await tx.lease.update({
        where: { id: existing.id },
        data: {
          status: LeaseStatus.EXPIRED,
          renewedToId: created.id,
        },
      });

      if (existing.tenantId) {
        const accessUpdate = await tx.unitAccess.updateMany({
          where: {
            unitId: existing.unitId,
            userId: existing.tenantId,
            role: 'TENANT',
            status: AccessStatus.ACTIVE,
          },
          data: {
            startsAt: startDate,
            endsAt: endDate,
            source: 'LEASE_ASSIGNMENT',
          },
        });

        if (accessUpdate.count === 0) {
          await tx.unitAccess.create({
            data: {
              unitId: existing.unitId,
              userId: existing.tenantId,
              role: 'TENANT',
              startsAt: startDate,
              endsAt: endDate,
              grantedBy: adminId,
              status: AccessStatus.ACTIVE,
              source: 'LEASE_ASSIGNMENT',
              canViewFinancials: true,
              canReceiveBilling: true,
              canBookFacilities: true,
              canGenerateQR: true,
              canManageWorkers: false,
            },
          });
        }
      }

      await tx.unit.update({
        where: { id: existing.unitId },
        data: { status: UnitStatus.LEASED },
      });

      return created;
    });

    return this.getLeaseDetail(renewedLease.id);
  }

  async terminateLease(
    id: string,
    dto: TerminateLeaseDto,
    _adminId: string,
  ): Promise<LeaseDetailResponseDto> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      select: {
        id: true,
        unitId: true,
        tenantId: true,
        status: true,
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }
    if (lease.status === LeaseStatus.TERMINATED) {
      throw new BadRequestException('Lease is already terminated');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.lease.update({
        where: { id },
        data: {
          status: LeaseStatus.TERMINATED,
          endDate: now,
        },
      });

      if (lease.tenantId) {
        await tx.unitAccess.updateMany({
          where: {
            unitId: lease.unitId,
            userId: lease.tenantId,
            role: 'TENANT',
            status: AccessStatus.ACTIVE,
          },
          data: {
            status: AccessStatus.REVOKED,
            endsAt: now,
          },
        });
      }

      await tx.unit.update({
        where: { id: lease.unitId },
        data: { status: UnitStatus.OCCUPIED },
      });

      // Current schema does not include a dedicated lease notes field;
      // keep the reason validated and available at API level.
      if (!dto.reason.trim()) {
        throw new BadRequestException('reason is required');
      }
    });

    return this.getLeaseDetail(id);
  }

  async listRentRequests(
    filters: ListRentRequestsDto,
  ): Promise<PaginatedRentRequestsResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RentRequestWhereInput = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    if (filters.search) {
      const search = filters.search.trim();
      if (search.length > 0) {
        where.OR = [
          { tenantName: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { tenantEmail: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { owner: { nameEN: { contains: search, mode: Prisma.QueryMode.insensitive } } },
          { unit: { unitNumber: { contains: search, mode: Prisma.QueryMode.insensitive } } },
        ];
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.rentRequest.count({ where }),
      this.prisma.rentRequest.findMany({
        where,
        include: {
          owner: {
            select: { nameEN: true, email: true },
          },
          unit: {
            select: { id: true, unitNumber: true },
          },
          reviewedBy: {
            select: { nameEN: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        unitId: row.unitId,
        unitNumber: row.unit.unitNumber,
        ownerUserId: row.ownerUserId,
        ownerName: row.owner.nameEN ?? null,
        ownerEmail: row.owner.email ?? null,
        tenantName: row.tenantName,
        tenantEmail: row.tenantEmail,
        tenantPhone: row.tenantPhone,
        tenantNationality: row.tenantNationality,
        status: row.status,
        rejectionReason: row.rejectionReason,
        requestedAt: row.requestedAt.toISOString(),
        reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
        reviewedByName: row.reviewedBy?.nameEN ?? null,
        contractFileId: row.contractFileId ?? null,
        tenantNationalIdFileId: row.tenantNationalIdFileId ?? null,
      })),
      total,
      page,
      limit,
    };
  }

  async approveRentRequest(id: string, adminId: string): Promise<RentRequestListItemDto> {
    await this.rentRequestsService.review(id, adminId, {
      status: RentRequestStatus.APPROVED,
    });
    return this.getRentRequestById(id);
  }

  async rejectRentRequest(
    id: string,
    dto: RejectRentRequestDto,
    adminId: string,
  ): Promise<RentRequestListItemDto> {
    await this.rentRequestsService.review(id, adminId, {
      status: RentRequestStatus.REJECTED,
      rejectionReason: dto.reason,
    });
    return this.getRentRequestById(id);
  }

  async getRentalStats(): Promise<RentalStatsResponseDto> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [activeLeases, expiringThisMonth, expiredLeases, pendingRentRequests, revenue, settings] =
      await Promise.all([
        this.prisma.lease.count({
          where: { status: LeaseStatus.ACTIVE },
        }),
        this.prisma.lease.count({
          where: {
            status: LeaseStatus.ACTIVE,
            endDate: {
              gte: now,
              lte: in30Days,
            },
          },
        }),
        this.prisma.lease.count({
          where: {
            OR: [
              { status: LeaseStatus.EXPIRED },
              {
                status: LeaseStatus.ACTIVE,
                endDate: { lt: now },
              },
            ],
          },
        }),
        this.prisma.rentRequest.count({
          where: { status: RentRequestStatus.PENDING },
        }),
        this.prisma.lease.aggregate({
          where: { status: LeaseStatus.ACTIVE },
          _sum: { monthlyRent: true },
        }),
        this.getRentalSettingsState(),
      ]);

    return {
      activeLeases,
      expiringThisMonth,
      expiredLeases,
      pendingRentRequests,
      totalMonthlyRevenue: this.decimalToNumberOrZero(revenue._sum.monthlyRent),
      leasingEnabled: settings.leasingEnabled,
    };
  }

  calculateDaysUntilExpiry(endDate: Date, status: LeaseStatus, now = new Date()): number | null {
    if (status !== LeaseStatus.ACTIVE) {
      return null;
    }
    const diffMs = endDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  }

  private async getRentRequestById(id: string): Promise<RentRequestListItemDto> {
    const row = await this.prisma.rentRequest.findUnique({
      where: { id },
      include: {
        owner: {
          select: { nameEN: true, email: true },
        },
        unit: {
          select: { id: true, unitNumber: true },
        },
        reviewedBy: {
          select: { nameEN: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Rent request not found');
    }

    return {
      id: row.id,
      unitId: row.unitId,
      unitNumber: row.unit.unitNumber,
      ownerUserId: row.ownerUserId,
      ownerName: row.owner.nameEN ?? null,
      ownerEmail: row.owner.email ?? null,
      tenantName: row.tenantName,
      tenantEmail: row.tenantEmail,
      tenantPhone: row.tenantPhone,
      tenantNationality: row.tenantNationality,
      status: row.status,
      rejectionReason: row.rejectionReason,
      requestedAt: row.requestedAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewedByName: row.reviewedBy?.nameEN ?? null,
      contractFileId: row.contractFileId ?? null,
      tenantNationalIdFileId: row.tenantNationalIdFileId ?? null,
    };
  }

  private async getRentalSettingsState(): Promise<RentalSettingsState> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { section: RENTAL_SETTINGS_SECTION },
      select: { value: true },
    });

    if (!row) {
      return DEFAULT_RENTAL_SETTINGS;
    }

    return this.parseRentalSettings(row.value);
  }

  async assertLeasingEnabled(): Promise<void> {
    const settings = await this.getRentalSettingsState();
    if (settings.leasingEnabled) {
      return;
    }
    const reason = settings.suspensionReason?.trim() || 'No reason provided';
    throw new ForbiddenException(
      `Leasing operations are currently suspended: ${reason}`,
    );
  }

  private parseRentalSettings(value: Prisma.JsonValue): RentalSettingsState {
    if (!this.isJsonObject(value)) {
      return DEFAULT_RENTAL_SETTINGS;
    }

    const leasingEnabled =
      typeof value.leasingEnabled === 'boolean'
        ? value.leasingEnabled
        : DEFAULT_RENTAL_SETTINGS.leasingEnabled;

    const suspensionReason =
      typeof value.suspensionReason === 'string' && value.suspensionReason.trim().length > 0
        ? value.suspensionReason
        : null;

    const suspendedAt =
      typeof value.suspendedAt === 'string' && value.suspendedAt.trim().length > 0
        ? value.suspendedAt
        : null;

    const suspendedById =
      typeof value.suspendedById === 'string' && value.suspendedById.trim().length > 0
        ? value.suspendedById
        : null;

    return {
      leasingEnabled,
      suspensionReason,
      suspendedAt,
      suspendedById,
    };
  }

  private isJsonObject(value: Prisma.JsonValue): value is Record<string, Prisma.JsonValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private decimalToNumber(value: Prisma.Decimal): number {
    return Number(value);
  }

  private decimalToNumberOrZero(value: Prisma.Decimal | null | undefined): number {
    if (!value) return 0;
    return Number(value);
  }

  private decimalToNullableNumber(value: Prisma.Decimal | null | undefined): number | null {
    if (!value) return null;
    return Number(value);
  }

  private mapLeasePerson(person: {
    id: string;
    nameEN: string | null;
    email: string | null;
    phone: string | null;
  }): LeasePersonSummaryDto {
    return {
      id: person.id,
      name: person.nameEN,
      email: person.email,
      phone: person.phone,
    };
  }

  private mapLeaseUnit(unit: {
    id: string;
    unitNumber: string;
    projectName: string;
    community: { name: string } | null;
  }): LeaseUnitSummaryDto {
    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
      projectName: unit.projectName,
      communityName: unit.community?.name ?? null,
    };
  }

  private async fetchRenewalLink(leaseId: string | null): Promise<LeaseRenewalLinkDto | null> {
    if (!leaseId) {
      return null;
    }
    const row = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      status: row.status,
    };
  }

  private async buildRenewalChain(current: {
    id: string;
    renewedFromId: string | null;
    renewedToId: string | null;
    startDate: Date;
    endDate: Date;
    status: LeaseStatus;
  }): Promise<LeaseRenewalLinkDto[]> {
    const before: LeaseRenewalLinkDto[] = [];
    const after: LeaseRenewalLinkDto[] = [];
    const seen = new Set<string>([current.id]);

    let cursorPrev = current.renewedFromId;
    let guard = 0;
    while (cursorPrev && guard < 20 && !seen.has(cursorPrev)) {
      const row = await this.fetchRenewalRow(cursorPrev);
      if (!row) break;
      seen.add(row.id);
      before.unshift(this.mapRenewalLink(row));
      cursorPrev = row.renewedFromId;
      guard += 1;
    }

    let cursorNext = current.renewedToId;
    guard = 0;
    while (cursorNext && guard < 20 && !seen.has(cursorNext)) {
      const row = await this.fetchRenewalRow(cursorNext);
      if (!row) break;
      seen.add(row.id);
      after.push(this.mapRenewalLink(row));
      cursorNext = row.renewedToId;
      guard += 1;
    }

    return [
      ...before,
      {
        id: current.id,
        startDate: current.startDate.toISOString(),
        endDate: current.endDate.toISOString(),
        status: current.status,
      },
      ...after,
    ];
  }

  private async fetchRenewalRow(id: string): Promise<RenewalLinkRow | null> {
    return this.prisma.lease.findUnique({
      where: { id },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        renewedFromId: true,
        renewedToId: true,
      },
    });
  }

  private mapRenewalLink(row: RenewalLinkRow): LeaseRenewalLinkDto {
    return {
      id: row.id,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      status: row.status,
    };
  }

  private async listLeaseInvoices(
    _leaseId: string,
    unitId: string,
    tenantId: string | null,
    leaseStart: Date,
    leaseEnd: Date,
  ): Promise<LeaseInvoiceHistoryItemDto[]> {
    const where: Prisma.InvoiceWhereInput = {
      unitId,
      dueDate: {
        gte: leaseStart,
        lte: leaseEnd,
      },
      ...(tenantId ? { residentId: tenantId } : {}),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        amount: true,
        status: true,
        paidDate: true,
      },
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return invoices.map((item) => ({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      dueDate: item.dueDate.toISOString(),
      amount: this.decimalToNumber(item.amount),
      status: item.status,
      paidDate: item.paidDate ? item.paidDate.toISOString() : null,
    }));
  }
}
