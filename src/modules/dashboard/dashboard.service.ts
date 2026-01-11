import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { DashboardIncidentsQueryDto } from './dto/dashboard-incidents-query.dto';
import { DashboardComplaintsQueryDto } from './dto/dashboard-complaints-query.dto';
import { DashboardRevenueQueryDto } from './dto/dashboard-revenue-query.dto';
import { DashboardOccupancyQueryDto } from './dto/dashboard-occupancy-query.dto';
import { DashboardDevicesQueryDto } from './dto/dashboard-devices-query.dto';
import { paginate, buildWhereClause } from '../../common/utils/pagination.util';
import dayjs from 'dayjs';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

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

    // Pending registrations
    const pendingRegistrations = await this.prisma.pendingRegistration.count({
      where: { status: 'PENDING' },
    });

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

    const filters: Record<string, any> = {
      status,
      priority,
      unitId,
      reportedAtFrom: dateFrom,
      reportedAtTo: dateTo,
    };

    if (projectName || block) {
      filters.unit = {};
      if (projectName) filters.unit.projectName = projectName;
      if (block) filters.unit.block = block;
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

    const filters: Record<string, any> = {
      status,
      priority,
      unitId,
      createdAtFrom: dateFrom,
      createdAtTo: dateTo,
    };

    if (projectName || block) {
      filters.unit = {};
      if (projectName) filters.unit.projectName = projectName;
      if (block) filters.unit.block = block;
    }

    return paginate(this.prisma.complaint, baseQuery, {
      searchFields: ['complaintNumber', 'category', 'description'],
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

    const whereClause: Record<string, any> = {
      status: 'PAID',
    };

    if (dateFrom) whereClause.paidDate = { ...whereClause.paidDate, gte: new Date(dateFrom) };
    if (dateTo) whereClause.paidDate = { ...whereClause.paidDate, lte: new Date(dateTo) };
    if (unitId) whereClause.unitId = unitId;

    if (projectName || block) {
      whereClause.unit = {};
      if (projectName) whereClause.unit.projectName = projectName;
      if (block) whereClause.unit.block = block;
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
    const monthlyData = revenueData.reduce((acc, invoice) => {
      if (!invoice.paidDate) return acc;
      const month = dayjs(invoice.paidDate).format('YYYY-MM');
      if (!acc[month]) acc[month] = 0;
      acc[month] += invoice.amount.toNumber();
      return acc;
    }, {} as Record<string, number>);

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

    const whereClause: Record<string, any> = {};
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

    const whereClause: Record<string, any> = { type };
    if (unitId) whereClause.unitId = unitId;
    if (projectName || block) {
      whereClause.unit = {};
      if (projectName) whereClause.unit.projectName = projectName;
      if (block) whereClause.unit.block = block;
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
