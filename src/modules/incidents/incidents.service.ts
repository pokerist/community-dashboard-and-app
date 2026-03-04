import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsQueryDto } from './dto/incidents-query.dto';
import {
  Audience,
  Channel,
  IncidentStatus,
  NotificationType,
  Priority,
} from '@prisma/client';
import dayjs from 'dayjs';
import { paginate } from '../../common/utils/pagination.util';
import { IncidentCreatedEvent } from '../../events/contracts/incident-created.event';
import { IncidentResolvedEvent } from '../../events/contracts/incident-resolved.event';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSosAlertDto } from './dto/create-sos-alert.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private notificationsService: NotificationsService,
  ) {}

  async createSosAlert(userId: string, dto: CreateSosAlertDto) {
    let unitId = dto.unitId;
    if (unitId) {
      await getActiveUnitAccess(this.prisma, userId, unitId);
    } else {
      const now = new Date();
      const fallbackAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
        select: { unitId: true },
        orderBy: { createdAt: 'desc' },
      });
      unitId = fallbackAccess?.unitId;
    }

    const [user, unit] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nameEN: true,
          nameAR: true,
          email: true,
          phone: true,
        },
      }),
      unitId
        ? this.prisma.unit.findUnique({
            where: { id: unitId },
            select: { id: true, projectName: true, block: true, unitNumber: true },
          })
        : Promise.resolve(null),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const displayName = user.nameEN || user.nameAR || user.email || 'Resident';
    const locationText = dto.location
      ? `GPS(${dto.location.lat.toFixed(6)}, ${dto.location.lng.toFixed(6)})`
      : unit
        ? `${unit.projectName || 'Community'} • ${unit.block || ''} • ${unit.unitNumber || ''}`
        : 'Location not provided';
    const note = dto.note?.trim() || null;

    const incident = await this.create({
      type: 'SOS_ALERT',
      location: locationText,
      residentName: displayName,
      description: [
        'SOS alert sent from resident mobile app.',
        note ? `Resident note: ${note}` : null,
        dto.voiceAttachmentId ? 'Voice note attached.' : null,
      ]
        .filter(Boolean)
        .join('\n'),
      priority: Priority.MEDIUM,
      unitId: unitId || undefined,
      attachmentIds: dto.voiceAttachmentId ? [dto.voiceAttachmentId] : [],
    });

    const adminRecipients = await this.prisma.admin.findMany({
      select: { userId: true },
      take: 200,
    });

    const adminUserIds = adminRecipients
      .map((row) => row.userId)
      .filter((id): id is string => Boolean(id));

    if (adminUserIds.length > 0) {
      await this.notificationsService.sendNotification(
        {
          type: NotificationType.EMERGENCY_ALERT,
          title: 'SOS Alert Received',
          messageEn: `${displayName} sent an SOS alert${unit ? ` from Unit ${unit.unitNumber || ''}` : ''}.`,
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: adminUserIds },
          payload: {
            route: '/security-emergency',
            entityType: 'INCIDENT',
            entityId: incident.id,
            eventKey: 'incident.sos.created',
            source: 'MOBILE_SOS',
            unitId: unitId || null,
            reporterUserId: userId,
            reporterName: displayName,
            reporterPhone: user.phone || null,
            location: dto.location || null,
            voiceAttachmentId: dto.voiceAttachmentId || null,
          },
        },
        userId,
      );
    }

    return incident;
  }

  async generateIncidentNumber(): Promise<string> {
    const sequence = await this.prisma.incidentSequence.upsert({
      where: { name: 'incident' },
      update: { counter: { increment: 1 } },
      create: { name: 'incident', counter: 1 },
    });
    return `INC-${sequence.counter.toString().padStart(4, '0')}`;
  }

  async create(createIncidentDto: CreateIncidentDto) {
    const { attachmentIds = [], ...incidentData } = createIncidentDto;
    const incidentNumber = await this.generateIncidentNumber();

    return this.prisma.$transaction(async (tx) => {
      if (incidentData.unitId) {
        const unitExists = await tx.unit.findUnique({
          where: { id: incidentData.unitId },
          select: { id: true },
        });
        if (!unitExists) {
          throw new BadRequestException('Unit not found');
        }
      }

      const incident = await tx.incident.create({
        data: {
          ...incidentData,
          incidentNumber,
          status: IncidentStatus.OPEN,
          reportedAt: new Date(),
        },
      });

      // Create attachments if provided
      if (attachmentIds.length > 0) {
        const attachmentsData = attachmentIds.map((fileId) => ({
          fileId: fileId,
          incidentId: incident.id,
          entityId: incident.id,
          entity: 'INCIDENT',
        }));
        await tx.attachment.createMany({
          data: attachmentsData,
          skipDuplicates: true,
        });
      }

      // Emit incident created event
      this.eventEmitter.emit(
        'incident.created',
        new IncidentCreatedEvent(
          incident.id,
          incident.incidentNumber,
          incident.type,
          incident.priority,
          incident.unitId,
        ),
      );

      return incident;
    });
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

    const averageResponseTime =
      resolvedIncidents.length > 0
        ? Math.round(
            resolvedIncidents.reduce(
              (sum, inc) => sum + (inc.responseTime || 0),
              0,
            ) / resolvedIncidents.length,
          )
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
    const {
      status,
      priority,
      reportedAtFrom,
      reportedAtTo,
      unitId,
      ...baseQuery
    } = query;

    // Build filters object with proper date range filtering
    const filters: Record<string, any> = {
      status,
      priority,
      unitId,
    };

    // Add date range filters if provided
    if (reportedAtFrom || reportedAtTo) {
      filters.reportedAt = {};
      if (reportedAtFrom) {
        filters.reportedAt.gte = new Date(reportedAtFrom);
      }
      if (reportedAtTo) {
        filters.reportedAt.lte = new Date(reportedAtTo);
      }
    }

    return paginate(this.prisma.incident, baseQuery, {
      searchFields: [
        'type',
        'location',
        'residentName',
        'description',
        'incidentNumber',
      ],
      additionalFilters: filters,
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
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
          },
        },
      },
    });
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

    const responseTime = Math.floor(
      (Date.now() - incident.reportedAt.getTime()) / 1000,
    ); // in seconds

    const updatedIncident = await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        responseTime,
      },
    });

    // Emit incident resolved event
    this.eventEmitter.emit(
      'incident.resolved',
      new IncidentResolvedEvent(
        updatedIncident.id,
        updatedIncident.incidentNumber,
        updatedIncident.type,
        updatedIncident.unitId,
        responseTime,
      ),
    );

    return updatedIncident;
  }
}
