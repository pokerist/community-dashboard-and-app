import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsQueryDto } from './dto/incidents-query.dto';
import { IncidentStatus } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async generateIncidentNumber(): Promise<string> {
    const sequence = await this.prisma.incidentSequence.upsert({
      where: { name: 'incident' },
      update: { counter: { increment: 1 } },
      create: { name: 'incident', counter: 1 },
    });
    return `INC-${sequence.counter.toString().padStart(4, '0')}`;
  }

  async create(createIncidentDto: CreateIncidentDto) {
    const { attachmentIds, ...incidentData } = createIncidentDto;
    const incidentNumber = await this.generateIncidentNumber();

    const incident = await this.prisma.incident.create({
      data: {
        ...incidentData,
        incidentNumber,
        status: IncidentStatus.OPEN,
        reportedAt: new Date(),
      },
    });

    if (attachmentIds && attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: { fileId: { in: attachmentIds } },
        data: { incidentId: incident.id },
      });
    }

    return incident;
  }

  async findCards() {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().add(1, 'day').startOf('day').toDate();

    // Active incidents count
    const activeIncidents = await this.prisma.incident.count({
      where: { status: IncidentStatus.OPEN },
    });

    // Incidents resolved today
    const incidentsResolvedToday = await this.prisma.incident.count({
      where: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Average response time for resolved incidents
    const resolvedIncidents = await this.prisma.incident.findMany({
      where: { status: IncidentStatus.RESOLVED, responseTime: { not: null } },
      select: { responseTime: true },
    });

    const averageResponseTime = resolvedIncidents.length > 0
      ? Math.round(resolvedIncidents.reduce((sum, inc) => sum + (inc.responseTime || 0), 0) / resolvedIncidents.length)
      : 0;

    // Total CCTV cameras
    const totalCCTVCameras = await this.prisma.smartDevice.count({
      where: { type: 'CAMERA' },
    });

    return {
      activeIncidents,
      incidentsResolvedToday,
      averageResponseTime,
      totalCCTVCameras,
    };
  }

  async findAll(query: IncidentsQueryDto) {
    const { page = 1, limit = 10, status, priority, dateRange } = query;
    const skip = (page - 1) * limit;

    let where: any = {};

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (dateRange) {
      const [start, end] = dateRange.split(',');
      where.reportedAt = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: {
          id: true,
          incidentNumber: true,
          type: true,
          location: true,
          residentName: true,
          description: true,
          priority: true,
          status: true,
          responseTime: true,
          reportedAt: true,
        },
        skip,
        take: limit,
        orderBy: { reportedAt: 'desc' },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      data: incidents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async resolve(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    if (incident.status !== IncidentStatus.OPEN) {
      throw new BadRequestException('Only open incidents can be resolved');
    }

    const responseTime = Math.floor((Date.now() - incident.reportedAt.getTime()) / 1000); // in seconds

    return this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        responseTime,
      },
    });
  }
}
