import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessGrantPermission,
  AccessStatus,
  BlueCollarRequestStatus,
  BlueCollarWeekDay,
  ContractorRoleEnum,
  EntityStatus,
  MemberStatusEnum,
  Prisma,
  QRType,
  UnitAccessRole,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { HikCentralQrService } from '../access-control/hikcentral/hikcentral-qr.service';
import {
  BlueCollarHolidayResponseDto,
  BlueCollarSettingsResponseDto,
  BlueCollarTermsResponseDto,
  BlueCollarWorkerDetailResponseDto,
  BlueCollarWorkerListItemResponseDto,
  BlueCollarWorkerStatsResponseDto,
  PaginatedBlueCollarWorkersResponseDto,
} from './dto/blue-collar-admin-response.dto';
import { BlueCollarAccessRequestResponseDto } from './dto/blue-collar-response.dto';
import { BlueCollarSettingsDto } from './dto/blue-collar-settings.dto';
import { CreateBlueCollarAccessRequestDto } from './dto/create-blue-collar-access-request.dto';
import { ListBlueCollarAccessRequestsDto } from './dto/list-blue-collar-access-requests.dto';
import { ListBlueCollarWorkersDto } from './dto/list-blue-collar-workers.dto';
import { ReviewBlueCollarAccessRequestDto } from './dto/review-blue-collar-access-request.dto';
import { AddHolidayDto } from './dto/add-holiday.dto';
import { RejectWorkerAccessDto } from './dto/reject-worker-access.dto';
import { UpdateTermsDto } from './dto/update-terms.dto';
import { WorkerAccessDecisionResponseDto } from './dto/worker-access-decision-response.dto';

const requestInclude = {
  worker: {
    include: {
      accessProfile: {
        select: {
          fullName: true,
          nationalId: true,
          status: true,
        },
      },
    },
  },
  contractor: true,
  qrCode: true,
} satisfies Prisma.BlueCollarAccessRequestInclude;

type BlueCollarRequestRow = Prisma.BlueCollarAccessRequestGetPayload<{
  include: typeof requestInclude;
}>;

type BlueCollarSettingRow = Prisma.BlueCollarSettingGetPayload<object>;

type WorkerListRow = Prisma.WorkerGetPayload<{
  include: {
    accessProfile: true;
    contractor: true;
    unit: {
      select: {
        unitNumber: true;
      };
    };
  };
}>;

@Injectable()
export class BlueCollarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hikCentralQr: HikCentralQrService,
  ) {}

  async getSettings(communityId: string): Promise<BlueCollarSettingsResponseDto | null> {
    const row = await this.prisma.blueCollarSetting.findFirst({
      where: {
        communityId,
        deletedAt: null,
      },
    });
    return row ? this.mapAdminSetting(row) : null;
  }

  async upsertSettings(
    communityId: string,
    dto: BlueCollarSettingsDto,
    actorUserId: string,
  ): Promise<BlueCollarSettingsResponseDto> {
    await this.assertAdmin(actorUserId);
    await this.assertCommunityExists(communityId);
    this.validateWorkingHours(dto.workingHoursStart, dto.workingHoursEnd);
    this.validateAllowedDays(dto.allowedDays);

    const workingDays = this.daysToWeekDays(dto.allowedDays);

    const setting = await this.prisma.blueCollarSetting.upsert({
      where: { communityId },
      create: {
        communityId,
        workingHoursStart: dto.workingHoursStart,
        workingHoursEnd: dto.workingHoursEnd,
        allowedDays: Array.from(new Set(dto.allowedDays)),
        workStartTime: dto.workingHoursStart,
        workEndTime: dto.workingHoursEnd,
        workDays: workingDays,
        termsAndConditions: null,
        termsVersion: 1,
        requiresAdminApproval: true,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      update: {
        workingHoursStart: dto.workingHoursStart,
        workingHoursEnd: dto.workingHoursEnd,
        allowedDays: Array.from(new Set(dto.allowedDays)),
        workStartTime: dto.workingHoursStart,
        workEndTime: dto.workingHoursEnd,
        workDays: workingDays,
        updatedById: actorUserId,
        deletedAt: null,
      },
    });

    return this.mapAdminSetting(setting);
  }

  async listHolidays(
    communityId: string,
    year?: number,
  ): Promise<BlueCollarHolidayResponseDto[]> {
    await this.assertCommunityExists(communityId);

    const startDate = year ? new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)) : undefined;
    const endDate = year ? new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) : undefined;

    const rows = await this.prisma.blueCollarHoliday.findMany({
      where: {
        communityId,
        ...(startDate && endDate
          ? {
              date: {
                gte: startDate,
                lte: endDate,
              },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      communityId: row.communityId,
      date: row.date.toISOString(),
      label: row.label,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async addHoliday(
    communityId: string,
    dto: AddHolidayDto,
    actorUserId: string,
  ): Promise<BlueCollarHolidayResponseDto> {
    await this.assertAdmin(actorUserId);
    await this.assertCommunityExists(communityId);

    const normalizedDate = this.normalizeHolidayDate(dto.date);

    try {
      const row = await this.prisma.blueCollarHoliday.create({
        data: {
          communityId,
          date: normalizedDate,
          label: dto.label.trim(),
        },
      });

      return {
        id: row.id,
        communityId: row.communityId,
        date: row.date.toISOString(),
        label: row.label,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Holiday already exists for this date');
      }
      throw error;
    }
  }

  async removeHoliday(id: string, actorUserId: string): Promise<{ success: true }> {
    await this.assertAdmin(actorUserId);

    const row = await this.prisma.blueCollarHoliday.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Holiday not found');
    }

    await this.prisma.blueCollarHoliday.delete({
      where: { id },
    });

    return { success: true };
  }

  async getTermsAndConditions(communityId: string): Promise<BlueCollarTermsResponseDto> {
    await this.assertCommunityExists(communityId);
    const row = await this.prisma.blueCollarSetting.findUnique({
      where: { communityId },
      select: {
        termsAndConditions: true,
        termsVersion: true,
        updatedAt: true,
      },
    });

    return {
      terms: row?.termsAndConditions ?? '',
      version: row?.termsVersion ?? 1,
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  }

  async updateTermsAndConditions(
    communityId: string,
    dto: UpdateTermsDto,
    actorUserId: string,
  ): Promise<BlueCollarTermsResponseDto> {
    await this.assertAdmin(actorUserId);
    await this.assertCommunityExists(communityId);

    const existing = await this.prisma.blueCollarSetting.findUnique({
      where: { communityId },
      select: { id: true, termsVersion: true },
    });

    const row = existing
      ? await this.prisma.blueCollarSetting.update({
          where: { id: existing.id },
          data: {
            termsAndConditions: dto.terms.trim(),
            termsVersion: existing.termsVersion + 1,
            updatedById: actorUserId,
            deletedAt: null,
          },
        })
      : await this.prisma.blueCollarSetting.create({
          data: {
            communityId,
            workingHoursStart: '07:00',
            workingHoursEnd: '18:00',
            allowedDays: [1, 2, 3, 4, 5],
            workStartTime: '07:00',
            workEndTime: '18:00',
            workDays: [
              BlueCollarWeekDay.MONDAY,
              BlueCollarWeekDay.TUESDAY,
              BlueCollarWeekDay.WEDNESDAY,
              BlueCollarWeekDay.THURSDAY,
              BlueCollarWeekDay.FRIDAY,
            ],
            termsAndConditions: dto.terms.trim(),
            termsVersion: 1,
            requiresAdminApproval: true,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });

    return {
      terms: row.termsAndConditions ?? '',
      version: row.termsVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listWorkers(
    filters: ListBlueCollarWorkersDto,
  ): Promise<PaginatedBlueCollarWorkersResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkerWhereInput = {
      ...(filters.communityId ? { unit: { communityId: filters.communityId } } : {}),
      ...(filters.contractorId ? { contractorId: filters.contractorId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      ...(filters.search
        ? {
            accessProfile: {
              OR: [
                {
                  fullName: {
                    contains: filters.search.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  nationalId: {
                    contains: filters.search.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.worker.count({ where }),
      this.prisma.worker.findMany({
        where,
        include: {
          accessProfile: true,
          contractor: true,
          unit: {
            select: {
              unitNumber: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.mapWorkerListItem(row)),
      total,
      page,
      limit,
    };
  }

  async getWorkerDetail(workerId: string): Promise<BlueCollarWorkerDetailResponseDto> {
    const row = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        accessProfile: {
          include: {
            accessGrants: {
              orderBy: [{ validFrom: 'desc' }],
            },
          },
        },
        contractor: true,
        unit: {
          select: {
            unitNumber: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Worker not found');
    }

    return {
      id: row.id,
      accessProfileId: row.accessProfileId,
      fullName: row.accessProfile.fullName,
      nationalId: row.accessProfile.nationalId,
      phone: row.accessProfile.phone,
      photoId: row.accessProfile.photoId,
      notes: row.accessProfile.notes,
      jobType: row.jobType,
      status: row.status,
      accessProfileStatus: row.accessProfile.status,
      contractorName: row.contractor.name,
      unitNumber: row.unit.unitNumber,
      accessGrants: row.accessProfile.accessGrants.map((grant) => ({
        id: grant.id,
        unitId: grant.unitId,
        validFrom: grant.validFrom.toISOString(),
        validTo: grant.validTo.toISOString(),
        permissions: grant.permissions,
      })),
    };
  }

  async approveWorkerAccess(
    accessProfileId: string,
    actorUserId: string,
  ): Promise<WorkerAccessDecisionResponseDto> {
    await this.assertAdmin(actorUserId);

    const profile = await this.prisma.accessProfile.findUnique({
      where: { id: accessProfileId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Access profile not found');
    }

    const updated = await this.prisma.accessProfile.update({
      where: { id: accessProfileId },
      data: {
        status: AccessStatus.ACTIVE,
      },
      select: {
        id: true,
        status: true,
        notes: true,
      },
    });

    return {
      accessProfileId: updated.id,
      status: updated.status,
      notes: updated.notes,
    };
  }

  async rejectWorkerAccess(
    accessProfileId: string,
    dto: RejectWorkerAccessDto,
    actorUserId: string,
  ): Promise<WorkerAccessDecisionResponseDto> {
    await this.assertAdmin(actorUserId);

    const profile = await this.prisma.accessProfile.findUnique({
      where: { id: accessProfileId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Access profile not found');
    }

    const updated = await this.prisma.accessProfile.update({
      where: { id: accessProfileId },
      data: {
        status: AccessStatus.REVOKED,
        notes: dto.reason.trim(),
      },
      select: {
        id: true,
        status: true,
        notes: true,
      },
    });

    return {
      accessProfileId: updated.id,
      status: updated.status,
      notes: updated.notes,
    };
  }

  async listPendingWorkers(
    communityId: string,
  ): Promise<BlueCollarWorkerListItemResponseDto[]> {
    await this.assertCommunityExists(communityId);

    const rows = await this.prisma.worker.findMany({
      where: {
        unit: { communityId },
        accessProfile: {
          status: AccessStatus.PENDING,
        },
      },
      include: {
        accessProfile: true,
        contractor: true,
        unit: {
          select: {
            unitNumber: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((row) => this.mapWorkerListItem(row));
  }

  async getWorkerStats(communityId: string): Promise<BlueCollarWorkerStatsResponseDto> {
    await this.assertCommunityExists(communityId);

    const baseWhere: Prisma.WorkerWhereInput = {
      unit: { communityId },
    };

    const [totalWorkers, activeWorkers, pendingApproval, contractorRows] = await Promise.all([
      this.prisma.worker.count({ where: baseWhere }),
      this.prisma.worker.count({
        where: {
          ...baseWhere,
          status: EntityStatus.ACTIVE,
          accessProfile: {
            status: AccessStatus.ACTIVE,
          },
        },
      }),
      this.prisma.worker.count({
        where: {
          ...baseWhere,
          accessProfile: {
            status: AccessStatus.PENDING,
          },
        },
      }),
      this.prisma.worker.findMany({
        where: baseWhere,
        select: { contractorId: true },
        distinct: ['contractorId'],
      }),
    ]);

    return {
      totalWorkers,
      activeWorkers,
      pendingApproval,
      contractorCount: contractorRows.length,
    };
  }

  async createAccessRequest(
    dto: CreateBlueCollarAccessRequestDto,
    actorUserId: string,
  ): Promise<BlueCollarAccessRequestResponseDto> {
    const requestedValidFrom = new Date(dto.requestedValidFrom);
    const requestedValidTo = new Date(dto.requestedValidTo);
    this.validateRequestWindow(requestedValidFrom, requestedValidTo);

    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      include: {
        accessProfile: {
          select: {
            id: true,
            status: true,
            fullName: true,
          },
        },
        contractor: {
          select: {
            id: true,
            status: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            communityId: true,
          },
        },
      },
    });
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }
    if (worker.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Only active workers can request access');
    }
    if (worker.contractor.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Worker contractor is not active');
    }
    if (worker.accessProfile.status !== AccessStatus.ACTIVE) {
      throw new BadRequestException('Worker access profile is not active');
    }
    if (!worker.unit.communityId) {
      throw new BadRequestException('Worker unit is not attached to a community');
    }

    await this.assertCanCreateRequest(actorUserId, worker.unit.id, worker.contractor.id);

    const settings = await this.prisma.blueCollarSetting.findFirst({
      where: {
        communityId: worker.unit.communityId,
        deletedAt: null,
      },
    });
    this.validateAgainstSettings(settings, requestedValidFrom, requestedValidTo);

    const existingPending = await this.prisma.blueCollarAccessRequest.findFirst({
      where: {
        workerId: worker.id,
        deletedAt: null,
        status: BlueCollarRequestStatus.PENDING,
        requestedValidFrom: { lt: requestedValidTo },
        requestedValidTo: { gt: requestedValidFrom },
      },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException('An overlapping pending request already exists for this worker');
    }

    const created = await this.prisma.blueCollarAccessRequest.create({
      data: {
        workerId: worker.id,
        unitId: worker.unit.id,
        contractorId: worker.contractor.id,
        settingId: settings?.id ?? null,
        requestedById: actorUserId,
        status: BlueCollarRequestStatus.PENDING,
        requestedValidFrom,
        requestedValidTo,
        gates: dto.gates ?? [],
        notes: dto.notes?.trim() || null,
        idDocumentRef: dto.idDocumentRef?.trim() || null,
      },
      include: requestInclude,
    });

    return this.mapRequest(created);
  }

  async listAccessRequests(
    query: ListBlueCollarAccessRequestsDto,
    actorUserId: string,
  ): Promise<BlueCollarAccessRequestResponseDto[]> {
    const admin = await this.isAdmin(actorUserId);

    if (!admin) {
      if (!query.unitId) {
        throw new BadRequestException('unitId is required for non-admin users');
      }

      const access = await getActiveUnitAccess(this.prisma, actorUserId, query.unitId);
      if (access.role !== UnitAccessRole.OWNER && access.role !== UnitAccessRole.DELEGATE) {
        throw new ForbiddenException('Not authorized to view blue collar requests for this unit');
      }
      if (access.role === UnitAccessRole.DELEGATE && !access.canManageWorkers) {
        throw new ForbiddenException('You do not have permission to manage workers');
      }

      const rows = await this.prisma.blueCollarAccessRequest.findMany({
        where: {
          deletedAt: null,
          unitId: query.unitId,
          ...(query.status ? { status: query.status } : {}),
          ...(query.communityId ? { unit: { communityId: query.communityId } } : {}),
          ...(access.role === UnitAccessRole.DELEGATE
            ? {
                contractor: {
                  members: {
                    some: {
                      userId: actorUserId,
                      status: MemberStatusEnum.ACTIVE,
                      role: {
                        in: [ContractorRoleEnum.ADMIN, ContractorRoleEnum.SUPERVISOR],
                      },
                    },
                  },
                },
              }
            : {}),
        },
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((row) => this.mapRequest(row));
    }

    const rows = await this.prisma.blueCollarAccessRequest.findMany({
      where: {
        deletedAt: null,
        ...(query.unitId ? { unitId: query.unitId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.communityId ? { unit: { communityId: query.communityId } } : {}),
      },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.mapRequest(row));
  }

  async reviewAccessRequest(
    requestId: string,
    dto: ReviewBlueCollarAccessRequestDto,
    actorUserId: string,
  ): Promise<BlueCollarAccessRequestResponseDto> {
    await this.assertAdmin(actorUserId);

    const requestRow = await this.prisma.blueCollarAccessRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
      },
      include: requestInclude,
    });
    if (!requestRow) {
      throw new NotFoundException('Blue collar access request not found');
    }
    if (requestRow.status !== BlueCollarRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    if (!dto.approve) {
      const reason = dto.reason?.trim();
      if (!reason) {
        throw new BadRequestException('Rejection reason is required');
      }

      const rejected = await this.prisma.blueCollarAccessRequest.update({
        where: { id: requestId },
        data: {
          status: BlueCollarRequestStatus.REJECTED,
          rejectionReason: reason,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
        },
        include: requestInclude,
      });

      return this.mapRequest(rejected);
    }

    if (requestRow.worker.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Worker is not active');
    }
    if (requestRow.contractor.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Contractor is not active');
    }
    if (requestRow.worker.accessProfile.status !== AccessStatus.ACTIVE) {
      throw new BadRequestException('Worker profile is not active');
    }

    let accessGrantId: string | null = null;
    let qrCodeId: string | null = null;

    try {
      const grant = await this.prisma.accessGrant.create({
        data: {
          accessProfileId: requestRow.worker.accessProfileId,
          unitId: requestRow.unitId,
          validFrom: requestRow.requestedValidFrom,
          validTo: requestRow.requestedValidTo,
          permissions: [AccessGrantPermission.WORK],
        },
        select: { id: true },
      });
      accessGrantId = grant.id;

      const hik = await this.hikCentralQr.createQrCode({
        unitId: requestRow.unitId,
        type: QRType.WORKER,
        validFrom: requestRow.requestedValidFrom,
        validTo: requestRow.requestedValidTo,
        visitorName: requestRow.worker.accessProfile.fullName,
        permissions: [AccessGrantPermission.WORK],
        gates: requestRow.gates,
        notes: requestRow.notes ?? undefined,
      });

      const qrCode = await this.prisma.accessQRCode.create({
        data: {
          qrId: hik.qrId,
          type: QRType.WORKER,
          generatedById: requestRow.requestedById,
          unitId: requestRow.unitId,
          accessGrantId: accessGrantId,
          visitorName: requestRow.worker.accessProfile.fullName,
          validFrom: requestRow.requestedValidFrom,
          validTo: requestRow.requestedValidTo,
          status: AccessStatus.ACTIVE,
          gates: requestRow.gates,
          notes: requestRow.notes,
          qrImageBase64: hik.qrImageBase64,
        },
        select: { id: true },
      });
      qrCodeId = qrCode.id;

      const approved = await this.prisma.blueCollarAccessRequest.update({
        where: { id: requestId },
        data: {
          status: BlueCollarRequestStatus.APPROVED,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
          qrCodeId,
        },
        include: requestInclude,
      });

      return this.mapRequest(approved);
    } catch (error: unknown) {
      if (qrCodeId) {
        await this.prisma.accessQRCode.delete({ where: { id: qrCodeId } }).catch(() => undefined);
      }
      if (accessGrantId) {
        await this.prisma.accessGrant
          .delete({ where: { id: accessGrantId } })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async assertCanCreateRequest(
    actorUserId: string,
    unitId: string,
    contractorId: string,
  ): Promise<void> {
    const admin = await this.isAdmin(actorUserId);
    if (admin) {
      return;
    }

    const access = await getActiveUnitAccess(this.prisma, actorUserId, unitId);
    if (access.role !== UnitAccessRole.OWNER && access.role !== UnitAccessRole.DELEGATE) {
      throw new ForbiddenException('Not authorized to manage workers for this unit');
    }
    if (!access.canManageWorkers) {
      throw new ForbiddenException('You do not have permission to manage workers');
    }

    if (access.role === UnitAccessRole.DELEGATE) {
      const member = await this.prisma.contractorMember.findFirst({
        where: {
          userId: actorUserId,
          contractorId,
          status: MemberStatusEnum.ACTIVE,
          role: {
            in: [ContractorRoleEnum.ADMIN, ContractorRoleEnum.SUPERVISOR],
          },
        },
        select: { id: true },
      });
      if (!member) {
        throw new ForbiddenException('You are not allowed to submit requests for this contractor');
      }
    }
  }

  private validateRequestWindow(requestedValidFrom: Date, requestedValidTo: Date): void {
    if (Number.isNaN(requestedValidFrom.getTime())) {
      throw new BadRequestException('requestedValidFrom must be a valid datetime');
    }
    if (Number.isNaN(requestedValidTo.getTime())) {
      throw new BadRequestException('requestedValidTo must be a valid datetime');
    }
    if (requestedValidTo <= requestedValidFrom) {
      throw new BadRequestException('requestedValidTo must be after requestedValidFrom');
    }
  }

  private validateAgainstSettings(
    settings: BlueCollarSettingRow | null,
    requestedValidFrom: Date,
    requestedValidTo: Date,
  ): void {
    if (!settings) {
      return;
    }

    const holidays = this.extractHolidayDates(settings.holidays);
    const fromDate = this.toDateOnly(requestedValidFrom);
    const toDate = this.toDateOnly(requestedValidTo);

    if (holidays.includes(fromDate) || holidays.includes(toDate)) {
      throw new BadRequestException('Selected dates overlap configured blue collar holidays');
    }

    if (settings.workDays.length > 0) {
      const fromDay = this.dayToEnum(requestedValidFrom.getDay());
      const toDay = this.dayToEnum(requestedValidTo.getDay());
      if (!settings.workDays.includes(fromDay) || !settings.workDays.includes(toDay)) {
        throw new BadRequestException('Requested date is outside configured blue collar work days');
      }
    }

    if (settings.workStartTime && settings.workEndTime) {
      const startMinutes = this.toMinutes(settings.workStartTime);
      const endMinutes = this.toMinutes(settings.workEndTime);
      const fromMinutes = requestedValidFrom.getHours() * 60 + requestedValidFrom.getMinutes();
      const toMinutes = requestedValidTo.getHours() * 60 + requestedValidTo.getMinutes();

      if (fromMinutes < startMinutes || fromMinutes > endMinutes) {
        throw new BadRequestException('requestedValidFrom is outside configured working hours');
      }
      if (toMinutes < startMinutes || toMinutes > endMinutes) {
        throw new BadRequestException('requestedValidTo is outside configured working hours');
      }
    }
  }

  private validateWorkingHours(workStartTime: string | null, workEndTime: string | null): void {
    if (!workStartTime && !workEndTime) {
      return;
    }
    if (!workStartTime || !workEndTime) {
      throw new BadRequestException('Both workStartTime and workEndTime are required');
    }

    const start = this.toMinutes(workStartTime);
    const end = this.toMinutes(workEndTime);
    if (end <= start) {
      throw new BadRequestException('workEndTime must be after workStartTime');
    }
  }

  private validateAllowedDays(days: number[]): void {
    if (!Array.isArray(days) || days.length === 0) {
      throw new BadRequestException('allowedDays must contain at least one day');
    }

    const invalidDay = days.find((day) => !Number.isInteger(day) || day < 0 || day > 6);
    if (invalidDay !== undefined) {
      throw new BadRequestException('allowedDays values must be between 0 and 6');
    }
  }

  private daysToWeekDays(days: number[]): BlueCollarWeekDay[] {
    return Array.from(new Set(days)).map((day) => this.dayToEnum(day));
  }

  private normalizeHolidayDate(value: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Holiday date must be valid');
    }
    return parsed;
  }

  private toMinutes(value: string): number {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
      throw new BadRequestException('Time must be in HH:mm format');
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private normalizeHolidayDates(values: string[]): string[] {
    const unique = Array.from(new Set(values.map((item) => item.trim()))).filter(Boolean);

    for (const value of unique) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException('Holiday dates must use YYYY-MM-DD format');
      }
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException('Holiday dates must be valid calendar dates');
      }
    }

    return unique;
  }

  private extractHolidayDates(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const dates: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'string') {
        dates.push(entry);
      }
    }
    return dates;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private dayToEnum(dayIndex: number): BlueCollarWeekDay {
    const map: Record<number, BlueCollarWeekDay> = {
      0: BlueCollarWeekDay.SUNDAY,
      1: BlueCollarWeekDay.MONDAY,
      2: BlueCollarWeekDay.TUESDAY,
      3: BlueCollarWeekDay.WEDNESDAY,
      4: BlueCollarWeekDay.THURSDAY,
      5: BlueCollarWeekDay.FRIDAY,
      6: BlueCollarWeekDay.SATURDAY,
    };
    return map[dayIndex];
  }

  private async assertCommunityExists(communityId: string): Promise<void> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
  }

  private async assertAdmin(userId: string): Promise<void> {
    const admin = await this.isAdmin(userId);
    if (!admin) {
      throw new ForbiddenException('Only admins can manage blue collar settings and approvals');
    }
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(admin);
  }

  private mapAdminSetting(row: BlueCollarSettingRow): BlueCollarSettingsResponseDto {
    return {
      id: row.id,
      communityId: row.communityId,
      workingHoursStart: row.workingHoursStart,
      workingHoursEnd: row.workingHoursEnd,
      allowedDays: row.allowedDays,
      termsAndConditions: row.termsAndConditions,
      termsVersion: row.termsVersion,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    };
  }

  private mapWorkerListItem(row: WorkerListRow): BlueCollarWorkerListItemResponseDto {
    return {
      id: row.id,
      accessProfileId: row.accessProfileId,
      fullName: row.accessProfile.fullName,
      nationalId: row.accessProfile.nationalId,
      jobType: row.jobType,
      contractorName: row.contractor.name,
      unitNumber: row.unit.unitNumber,
      status: row.status,
      accessProfileStatus: row.accessProfile.status,
    };
  }

  private mapRequest(row: BlueCollarRequestRow): BlueCollarAccessRequestResponseDto {
    return {
      id: row.id,
      workerId: row.workerId,
      unitId: row.unitId,
      contractorId: row.contractorId,
      settingId: row.settingId,
      requestedById: row.requestedById,
      reviewedById: row.reviewedById,
      qrCodeId: row.qrCodeId,
      idDocumentRef: row.idDocumentRef,
      status: row.status,
      requestedValidFrom: row.requestedValidFrom,
      requestedValidTo: row.requestedValidTo,
      gates: row.gates,
      notes: row.notes,
      rejectionReason: row.rejectionReason,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      worker: {
        id: row.worker.id,
        jobType: row.worker.jobType,
        status: row.worker.status,
        fullName: row.worker.accessProfile.fullName,
        nationalId: row.worker.accessProfile.nationalId,
      },
      contractor: {
        id: row.contractor.id,
        name: row.contractor.name,
        status: row.contractor.status,
      },
      qrCode: row.qrCode
        ? {
            id: row.qrCode.id,
            qrId: row.qrCode.qrId,
            type: row.qrCode.type,
            status: row.qrCode.status,
            validFrom: row.qrCode.validFrom,
            validTo: row.qrCode.validTo,
          }
        : null,
    };
  }
}
