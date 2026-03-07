import { Injectable } from '@nestjs/common';
import {
  AccessStatus,
  ComplaintStatus,
  EntityStatus,
  InvoiceStatus,
  Prisma,
  PushPlatform,
  QRType,
  UserStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { DashboardIncidentsQueryDto } from './dto/dashboard-incidents-query.dto';
import { DashboardComplaintsQueryDto } from './dto/dashboard-complaints-query.dto';
import { DashboardRevenueQueryDto } from './dto/dashboard-revenue-query.dto';
import { DashboardOccupancyQueryDto } from './dto/dashboard-occupancy-query.dto';
import { DashboardDevicesQueryDto } from './dto/dashboard-devices-query.dto';
import { paginate } from '../../common/utils/pagination.util';
import dayjs from 'dayjs';
import { DashboardPeriodQueryDto } from './dto/dashboard-period-query.dto';
import {
  DashboardActivityItemResponseDto,
  DashboardActivityType,
  DashboardPeriod,
  DashboardStatsResponseDto,
  DashboardTicketsByStatusDto,
} from './dto/dashboard-stats-response.dto';
import {
  CurrentVisitorDrilldownItemDto,
  DashboardDrilldownQueryDto,
  OpenComplaintDrilldownItemDto,
  RevenueDrilldownItemDto,
} from './dto/dashboard-drilldown.dto';

export interface DashboardPeriodWindow {
  period: DashboardPeriod;
  from: Date;
  to: Date;
  label: string;
}

interface ComplaintActivityRow {
  id: string;
  complaintNumber: string;
  categoryLegacy: string | null;
  category: { name: string } | null;
  createdAt: Date;
  reporter: { nameEN: string | null; nameAR: string | null } | null;
  unit: { unitNumber: string | null } | null;
}

interface ServiceRequestActivityRow {
  id: string;
  requestedAt: Date;
  createdBy: { nameEN: string | null; nameAR: string | null } | null;
  unit: { unitNumber: string | null } | null;
}

interface ViolationActivityRow {
  id: string;
  violationNumber: string;
  typeLegacy: string | null;
  category: { name: string } | null;
  createdAt: Date;
  issuedBy: { nameEN: string | null; nameAR: string | null } | null;
  unit: { unitNumber: string | null } | null;
}

interface InvoiceActivityRow {
  id: string;
  invoiceNumber: string;
  amount: { toNumber(): number };
  paidDate: Date | null;
  resident: { nameEN: string | null; nameAR: string | null } | null;
  unit: { unitNumber: string | null } | null;
}

interface PendingRegistrationActivityRow {
  id: string;
  name: string | null;
  createdAt: Date;
}

interface ActivityIntermediateItem {
  id: string;
  type: DashboardActivityType;
  description: string;
  actorName: string | null;
  unitNumber: string | null;
  timestamp: Date;
}

function displayName(value: {
  nameEN?: string | null;
  nameAR?: string | null;
} | null): string | null {
  if (!value) return null;
  return value.nameEN?.trim() || value.nameAR?.trim() || null;
}

function startOfQuarter(now: dayjs.Dayjs): dayjs.Dayjs {
  const quarterStartMonth = Math.floor(now.month() / 3) * 3;
  return now.month(quarterStartMonth).startOf('month');
}

function startOfHalfYear(now: dayjs.Dayjs): dayjs.Dayjs {
  const halfStartMonth = now.month() < 6 ? 0 : 6;
  return now.month(halfStartMonth).startOf('month');
}

export function resolvePeriodWindow(
  period: DashboardPeriod = DashboardPeriod.MONTHLY,
  referenceDate: Date = new Date(),
): DashboardPeriodWindow {
  const ref = dayjs(referenceDate);
  const to = ref.endOf('day');

  switch (period) {
    case DashboardPeriod.QUARTERLY: {
      const from = startOfQuarter(ref);
      const quarter = Math.floor(ref.month() / 3) + 1;
      return {
        period,
        from: from.toDate(),
        to: to.toDate(),
        label: `Q${quarter} ${ref.year()}`,
      };
    }
    case DashboardPeriod.SEMI_ANNUAL: {
      const from = startOfHalfYear(ref);
      const halfLabel = ref.month() < 6 ? 'H1' : 'H2';
      return {
        period,
        from: from.toDate(),
        to: to.toDate(),
        label: `${halfLabel} ${ref.year()}`,
      };
    }
    case DashboardPeriod.ANNUAL: {
      const from = ref.startOf('year');
      return {
        period,
        from: from.toDate(),
        to: to.toDate(),
        label: `${ref.year()}`,
      };
    }
    case DashboardPeriod.MONTHLY:
    default: {
      const from = ref.startOf('month');
      return {
        period: DashboardPeriod.MONTHLY,
        from: from.toDate(),
        to: to.toDate(),
        label: ref.format('MMMM YYYY'),
      };
    }
  }
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(
    query: DashboardPeriodQueryDto,
  ): Promise<DashboardStatsResponseDto> {
    const period = query.period ?? DashboardPeriod.MONTHLY;
    const periodWindow = resolvePeriodWindow(period);
    const activeUsersSince = dayjs().subtract(7, 'day').toDate();

    const complaintPeriodWhere: Prisma.ComplaintWhereInput = {
      createdAt: {
        gte: periodWindow.from,
        lte: periodWindow.to,
      },
    };

    const activeCommunityUsersWhere: Prisma.UserWhereInput = {
      signupSource: {
        equals: 'community',
        mode: Prisma.QueryMode.insensitive,
      },
      lastLoginAt: {
        gte: activeUsersSince,
      },
    };

    const [
      totalRegisteredDevicesByPlatform,
      activeMobileUsers,
      activeMobileUserPlatformRows,
      openComplaints,
      closedComplaints,
      totalComplaints,
      ticketsByStatusRows,
      revenueCurrentPeriod,
      occupiedUnits,
      totalUnits,
      currentVisitors,
      blueCollarWorkers,
      totalCars,
    ] = await Promise.all([
      this.prisma.notificationDeviceToken.groupBy({
        by: ['platform'],
        where: {
          isActive: true,
          platform: { in: [PushPlatform.ANDROID, PushPlatform.IOS] },
        },
        _count: { id: true },
      }),
      this.prisma.user.count({
        where: activeCommunityUsersWhere,
      }),
      this.prisma.notificationDeviceToken.findMany({
        where: {
          isActive: true,
          platform: { in: [PushPlatform.ANDROID, PushPlatform.IOS] },
          user: activeCommunityUsersWhere,
        },
        select: {
          userId: true,
          platform: true,
        },
        distinct: ['userId', 'platform'],
      }),
      this.prisma.complaint.count({
        where: {
          ...complaintPeriodWhere,
          status: {
            in: [ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS],
          },
        },
      }),
      this.prisma.complaint.count({
        where: {
          ...complaintPeriodWhere,
          status: {
            in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
          },
        },
      }),
      this.prisma.complaint.count({
        where: complaintPeriodWhere,
      }),
      this.prisma.complaint.groupBy({
        by: ['status'],
        where: complaintPeriodWhere,
        _count: { id: true },
      }),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          status: InvoiceStatus.PAID,
          paidDate: {
            gte: periodWindow.from,
            lte: periodWindow.to,
          },
        },
      }),
      this.prisma.unit.count({
        where: {
          status: 'OCCUPIED',
          isActive: true,
          deletedAt: null,
        },
      }),
      this.prisma.unit.count({
        where: {
          isActive: true,
          deletedAt: null,
        },
      }),
      this.prisma.accessQRCode.count({
        where: {
          type: QRType.VISITOR,
          status: AccessStatus.ACTIVE,
          checkedInAt: {
            not: null,
            gte: periodWindow.from,
            lte: periodWindow.to,
          },
          checkedOutAt: null,
        },
      }),
      this.prisma.worker.count({
        where: {
          status: EntityStatus.ACTIVE,
        },
      }),
      this.prisma.residentVehicle.count({
        where: {
          resident: {
            user: {
              userStatus: UserStatusEnum.ACTIVE,
            },
          },
        },
      }),
    ]);

    const totalDevicesBreakdown = {
      android:
        totalRegisteredDevicesByPlatform.find(
          (row) => row.platform === PushPlatform.ANDROID,
        )?._count.id ?? 0,
      ios:
        totalRegisteredDevicesByPlatform.find(
          (row) => row.platform === PushPlatform.IOS,
        )?._count.id ?? 0,
    };
    const totalRegisteredDevices =
      totalDevicesBreakdown.android + totalDevicesBreakdown.ios;

    const activeUsersBreakdown = activeMobileUserPlatformRows.reduce(
      (acc, row) => {
        if (row.platform === PushPlatform.ANDROID) {
          return { ...acc, android: acc.android + 1 };
        }
        if (row.platform === PushPlatform.IOS) {
          return { ...acc, ios: acc.ios + 1 };
        }
        return acc;
      },
      { android: 0, ios: 0 },
    );

    const ticketsByStatus: DashboardTicketsByStatusDto = {
      NEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };

    for (const row of ticketsByStatusRows) {
      ticketsByStatus[row.status] = row._count.id;
    }

    const occupancyRate =
      totalUnits > 0
        ? Number(((occupiedUnits / totalUnits) * 100).toFixed(2))
        : 0;

    return {
      period: periodWindow.period,
      periodLabel: periodWindow.label,
      kpis: {
        totalRegisteredDevices,
        totalRegisteredDevicesByPlatform: totalDevicesBreakdown,
        activeMobileUsers,
        activeMobileUsersByPlatform: activeUsersBreakdown,
        totalComplaints,
        openComplaints,
        closedComplaints,
        ticketsByStatus,
        revenueCurrentMonth: revenueCurrentPeriod._sum.amount?.toNumber() ?? 0,
        occupancyRate,
        currentVisitors,
        blueCollarWorkers,
        totalCars,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getActivity(): Promise<DashboardActivityItemResponseDto[]> {
    const [
      complaints,
      serviceRequests,
      violations,
      paidInvoices,
      registrations,
    ] = await Promise.all([
      this.prisma.complaint.findMany({
        select: {
          id: true,
          complaintNumber: true,
          categoryLegacy: true,
          category: {
            select: {
              name: true,
            },
          },
          createdAt: true,
          reporter: {
            select: { nameEN: true, nameAR: true },
          },
          unit: {
            select: { unitNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.serviceRequest.findMany({
        select: {
          id: true,
          requestedAt: true,
          createdBy: {
            select: { nameEN: true, nameAR: true },
          },
          unit: {
            select: { unitNumber: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      this.prisma.violation.findMany({
        select: {
          id: true,
          violationNumber: true,
          typeLegacy: true,
          category: {
            select: { name: true },
          },
          createdAt: true,
          issuedBy: {
            select: { nameEN: true, nameAR: true },
          },
          unit: {
            select: { unitNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          paidDate: { not: null },
        },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          paidDate: true,
          resident: {
            select: { nameEN: true, nameAR: true },
          },
          unit: {
            select: { unitNumber: true },
          },
        },
        orderBy: { paidDate: 'desc' },
        take: 20,
      }),
      this.prisma.pendingRegistration.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const complaintItems = complaints.map((row) =>
      this.mapComplaintActivity(row),
    );
    const serviceRequestItems = serviceRequests.map((row) =>
      this.mapServiceRequestActivity(row),
    );
    const violationItems = violations.map((row) =>
      this.mapViolationActivity(row),
    );
    const invoiceItems = paidInvoices.map((row) => this.mapInvoiceActivity(row));
    const registrationItems = registrations.map((row) =>
      this.mapRegistrationActivity(row),
    );

    return [
      ...complaintItems,
      ...serviceRequestItems,
      ...violationItems,
      ...invoiceItems,
      ...registrationItems,
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        actorName: item.actorName,
        unitNumber: item.unitNumber,
        timestamp: item.timestamp.toISOString(),
      }));
  }

  async getOpenComplaintsDrilldown(
    query: DashboardDrilldownQueryDto,
  ): Promise<OpenComplaintDrilldownItemDto[]> {
    const period = query.period ?? DashboardPeriod.MONTHLY;
    const periodWindow = resolvePeriodWindow(period);
    const limit = query.limit ?? 20;

    const rows = await this.prisma.complaint.findMany({
      where: {
        status: {
          in: [ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS],
        },
        createdAt: {
          gte: periodWindow.from,
          lte: periodWindow.to,
        },
      },
      select: {
        id: true,
        complaintNumber: true,
        categoryLegacy: true,
        category: {
          select: {
            name: true,
          },
        },
        priority: true,
        status: true,
        createdAt: true,
        unit: {
          select: {
            unitNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      complaintNumber: row.complaintNumber,
      category: row.category?.name ?? row.categoryLegacy ?? '-',
      priority: row.priority,
      status: row.status,
      unitNumber: row.unit?.unitNumber ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getCurrentVisitorsDrilldown(
    query: DashboardDrilldownQueryDto,
  ): Promise<CurrentVisitorDrilldownItemDto[]> {
    const period = query.period ?? DashboardPeriod.MONTHLY;
    const periodWindow = resolvePeriodWindow(period);
    const limit = query.limit ?? 20;

    const rows = await this.prisma.accessQRCode.findMany({
      where: {
        type: QRType.VISITOR,
        status: AccessStatus.ACTIVE,
        checkedInAt: {
          not: null,
          gte: periodWindow.from,
          lte: periodWindow.to,
        },
        checkedOutAt: null,
      },
      select: {
        id: true,
        visitorName: true,
        checkedInAt: true,
        validTo: true,
        forUnit: {
          select: {
            unitNumber: true,
          },
        },
      },
      orderBy: { checkedInAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      visitorName: row.visitorName ?? null,
      unitNumber: row.forUnit?.unitNumber ?? null,
      checkedInAt: row.checkedInAt ? row.checkedInAt.toISOString() : null,
      validTo: row.validTo.toISOString(),
    }));
  }

  async getRevenueDrilldown(
    query: DashboardDrilldownQueryDto,
  ): Promise<RevenueDrilldownItemDto[]> {
    const period = query.period ?? DashboardPeriod.MONTHLY;
    const periodWindow = resolvePeriodWindow(period);
    const limit = query.limit ?? 20;

    const rows = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PAID,
        paidDate: {
          not: null,
          gte: periodWindow.from,
          lte: periodWindow.to,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidDate: true,
        resident: {
          select: {
            nameEN: true,
            nameAR: true,
          },
        },
        unit: {
          select: {
            unitNumber: true,
          },
        },
      },
      orderBy: { paidDate: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      amount: row.amount.toNumber(),
      residentName: displayName(row.resident),
      unitNumber: row.unit?.unitNumber ?? null,
      paidDate: row.paidDate ? row.paidDate.toISOString() : new Date(0).toISOString(),
    }));
  }

  private mapComplaintActivity(row: ComplaintActivityRow): ActivityIntermediateItem {
    return {
      id: `complaint:${row.id}`,
      type: DashboardActivityType.COMPLAINT,
      description: `Complaint ${row.complaintNumber} created (${row.category?.name ?? row.categoryLegacy ?? 'General'})`,
      actorName: displayName(row.reporter),
      unitNumber: row.unit?.unitNumber ?? null,
      timestamp: row.createdAt,
    };
  }

  private mapServiceRequestActivity(
    row: ServiceRequestActivityRow,
  ): ActivityIntermediateItem {
    return {
      id: `service_request:${row.id}`,
      type: DashboardActivityType.SERVICE_REQUEST,
      description: `Service request ${row.id.slice(0, 8)} created`,
      actorName: displayName(row.createdBy),
      unitNumber: row.unit?.unitNumber ?? null,
      timestamp: row.requestedAt,
    };
  }

  private mapViolationActivity(row: ViolationActivityRow): ActivityIntermediateItem {
    return {
      id: `violation:${row.id}`,
      type: DashboardActivityType.VIOLATION,
      description: `Violation ${row.violationNumber} issued (${row.category?.name ?? row.typeLegacy ?? 'General'})`,
      actorName: displayName(row.issuedBy),
      unitNumber: row.unit?.unitNumber ?? null,
      timestamp: row.createdAt,
    };
  }

  private mapInvoiceActivity(row: InvoiceActivityRow): ActivityIntermediateItem {
    const paidAt = row.paidDate ?? new Date(0);
    return {
      id: `invoice:${row.id}`,
      type: DashboardActivityType.INVOICE,
      description: `Invoice ${row.invoiceNumber} paid (EGP ${row.amount.toNumber()})`,
      actorName: displayName(row.resident),
      unitNumber: row.unit?.unitNumber ?? null,
      timestamp: paidAt,
    };
  }

  private mapRegistrationActivity(
    row: PendingRegistrationActivityRow,
  ): ActivityIntermediateItem {
    return {
      id: `registration:${row.id}`,
      type: DashboardActivityType.REGISTRATION,
      description: `New registration submitted`,
      actorName: row.name?.trim() || null,
      unitNumber: null,
      timestamp: row.createdAt,
    };
  }

  async getSummary(): Promise<DashboardSummaryDto> {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const yearStart = dayjs().startOf('year').toDate();

    // Active incidents
    const activeIncidents = await this.prisma.incident.count({
      where: { status: 'OPEN' },
    });

    // Resolved today
    const resolvedToday = await this.prisma.incident.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Average response time
    const resolvedIncidents = await this.prisma.incident.findMany({
      where: {
        status: 'RESOLVED',
        responseTime: { not: null },
      },
      select: { responseTime: true },
    });
    const avgResponseTime =
      resolvedIncidents.length > 0
        ? Math.round(
            resolvedIncidents.reduce(
              (sum, inc) => sum + (inc.responseTime || 0),
              0,
            ) / resolvedIncidents.length,
          )
        : 0;

    // Open complaints
    const openComplaints = await this.prisma.complaint.count({
      where: {
        status: {
          notIn: ['RESOLVED', 'CLOSED'],
        },
      },
    });

    // Pending registrations (feature-flagged; currently shelved)
    const pendingRegistrationsEnabled =
      process.env.ENABLE_PENDING_REGISTRATIONS === 'true';
    const pendingRegistrations = pendingRegistrationsEnabled
      ? await this.prisma.pendingRegistration.count({
          where: { status: 'PENDING' },
        })
      : 0;

    // Occupancy rate
    const totalUnits = await this.prisma.unit.count();
    const occupiedUnits = await this.prisma.unit.count({
      where: { status: 'OCCUPIED' },
    });
    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    // Revenue this month
    const revenueThisMonth = await this.prisma.invoice.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        paidDate: {
          gte: monthStart,
        },
      },
    });

    // Revenue this year
    const revenueThisYear = await this.prisma.invoice.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        paidDate: {
          gte: yearStart,
        },
      },
    });

    // Smart devices status
    const smartDevices = await this.prisma.smartDevice.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const deviceCounts = smartDevices.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // CCTV cameras (assuming CAMERA type)
    const cctvCameras = await this.prisma.smartDevice.groupBy({
      by: ['status'],
      where: { type: 'CAMERA' },
      _count: { id: true },
    });
    const cctvCounts = cctvCameras.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      activeIncidents,
      resolvedToday,
      avgResponseTime,
      openComplaints,
      pendingRegistrations,
      occupancyRate,
      revenueThisMonth: revenueThisMonth._sum.amount?.toNumber() || 0,
      revenueThisYear: revenueThisYear._sum.amount?.toNumber() || 0,
      smartDevices: {
        online: deviceCounts.ONLINE || 0,
        offline: deviceCounts.OFFLINE || 0,
        error: deviceCounts.ERROR || 0,
      },
      cctvCameras: {
        online: cctvCounts.ONLINE || 0,
        offline: cctvCounts.OFFLINE || 0,
        error: cctvCounts.ERROR || 0,
      },
    };
  }

  async getIncidents(query: DashboardIncidentsQueryDto) {
    const {
      projectName,
      block,
      unitId,
      status,
      priority,
      dateFrom,
      dateTo,
      ...baseQuery
    } = query;

    const filters: Record<string, unknown> = {
      status,
      priority,
      unitId,
      reportedAtFrom: dateFrom,
      reportedAtTo: dateTo,
    };

    if (projectName || block) {
      const unitFilter: { projectName?: string; block?: string } = {};
      if (projectName) unitFilter.projectName = projectName;
      if (block) unitFilter.block = block;
      filters.unit = unitFilter;
    }

    return paginate(this.prisma.incident, baseQuery, {
      searchFields: [
        'incidentNumber',
        'type',
        'location',
        'residentName',
        'description',
      ],
      additionalFilters: filters,
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
            block: true,
          },
        },
      },
    });
  }

  async getComplaints(query: DashboardComplaintsQueryDto) {
    const {
      projectName,
      block,
      unitId,
      status,
      priority,
      dateFrom,
      dateTo,
      ...baseQuery
    } = query;

    const filters: Record<string, unknown> = {
      status,
      priority,
      unitId,
      createdAtFrom: dateFrom,
      createdAtTo: dateTo,
    };

    if (projectName || block) {
      const unitFilter: { projectName?: string; block?: string } = {};
      if (projectName) unitFilter.projectName = projectName;
      if (block) unitFilter.block = block;
      filters.unit = unitFilter;
    }

    return paginate(this.prisma.complaint, baseQuery, {
      searchFields: ['complaintNumber', 'categoryLegacy', 'description'],
      additionalFilters: filters,
      include: {
        reporter: {
          select: {
            nameEN: true,
            nameAR: true,
          },
        },
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
            block: true,
          },
        },
      },
    });
  }

  async getRevenue(query: DashboardRevenueQueryDto) {
    const { dateFrom, dateTo, projectName, block, unitId } = query;

    const whereClause: Prisma.InvoiceWhereInput = {
      status: InvoiceStatus.PAID,
    };

    const paidDateFilter: Prisma.DateTimeNullableFilter = {};
    if (dateFrom)
      paidDateFilter.gte = new Date(dateFrom);
    if (dateTo) paidDateFilter.lte = new Date(dateTo);
    if (dateFrom || dateTo) {
      whereClause.paidDate = paidDateFilter;
    }
    if (unitId) whereClause.unitId = unitId;

    if (projectName || block) {
      whereClause.unit = {
        ...(projectName ? { projectName } : {}),
        ...(block ? { block } : {}),
      };
    }

    // Get monthly revenue data
    const revenueData = await this.prisma.invoice.findMany({
      where: whereClause,
      select: {
        paidDate: true,
        amount: true,
      },
      orderBy: { paidDate: 'asc' },
    });

    // Group by month manually
    const monthlyData = revenueData.reduce(
      (acc, invoice) => {
        if (!invoice.paidDate) return acc;
        const month = dayjs(invoice.paidDate).format('YYYY-MM');
        if (!acc[month]) acc[month] = 0;
        acc[month] += invoice.amount.toNumber();
        return acc;
      },
      {} as Record<string, number>,
    );

    const chartData = Object.entries(monthlyData).map(([month, total]) => ({
      month,
      total,
    }));

    // Also get current month/year totals
    const currentMonthStart = dayjs().startOf('month').toDate();
    const currentMonthEnd = dayjs().endOf('month').toDate();
    const currentYearStart = dayjs().startOf('year').toDate();
    const currentYearEnd = dayjs().endOf('year').toDate();

    const [monthTotal, yearTotal] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          ...whereClause,
          paidDate: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          ...whereClause,
          paidDate: {
            gte: currentYearStart,
            lte: currentYearEnd,
          },
        },
      }),
    ]);

    return {
      chartData,
      currentMonth: monthTotal._sum.amount?.toNumber() || 0,
      currentYear: yearTotal._sum.amount?.toNumber() || 0,
    };
  }

  async getOccupancy(query: DashboardOccupancyQueryDto) {
    const { projectName, block } = query;

    const whereClause: Prisma.UnitWhereInput = {};
    if (projectName) whereClause.projectName = projectName;
    if (block) whereClause.block = block;

    // Get occupancy by project/block
    const occupancyData = await this.prisma.unit.groupBy({
      by: ['projectName', 'block'],
      where: whereClause,
      _count: { id: true },
    });

    const occupancyByLocation = await Promise.all(
      occupancyData.map(async (group) => {
        const totalUnits = group._count.id;
        const occupiedUnits = await this.prisma.unit.count({
          where: {
            projectName: group.projectName,
            block: group.block,
            status: 'OCCUPIED',
          },
        });
        return {
          projectName: group.projectName,
          block: group.block,
          totalUnits,
          occupiedUnits,
          occupancyRate:
            totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        };
      }),
    );

    // Overall occupancy
    const totalUnits = await this.prisma.unit.count({ where: whereClause });
    const occupiedUnits = await this.prisma.unit.count({
      where: {
        ...whereClause,
        status: 'OCCUPIED',
      },
    });

    return {
      overall: {
        totalUnits,
        occupiedUnits,
        occupancyRate:
          totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      },
      byLocation: occupancyByLocation,
    };
  }

  async getDevices(query: DashboardDevicesQueryDto) {
    const { projectName, block, unitId, type } = query;

    const whereClause: Prisma.SmartDeviceWhereInput = {
      ...(type ? { type } : {}),
    };
    if (unitId) whereClause.unitId = unitId;
    if (projectName || block) {
      whereClause.unit = {
        ...(projectName ? { projectName } : {}),
        ...(block ? { block } : {}),
      };
    }

    const devices = await this.prisma.smartDevice.groupBy({
      by: ['status', 'type'],
      where: whereClause,
      _count: { id: true },
    });

    const deviceStats = devices.reduce(
      (acc, device) => {
        const key = device.type;
        if (!acc[key]) acc[key] = { online: 0, offline: 0, error: 0 };
        acc[key][device.status.toLowerCase()] = device._count.id;
        return acc;
      },
      {} as Record<string, { online: number; offline: number; error: number }>,
    );

    return {
      stats: deviceStats,
      total: devices.reduce((sum, device) => sum + device._count.id, 0),
    };
  }
}
