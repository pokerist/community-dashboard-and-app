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
  ContractorRoleEnum,
  EntityStatus,
  MemberStatusEnum,
  Prisma,
  QRType,
  UnitAccessRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';
import { HikCentralQrService } from '../access-control/hikcentral/hikcentral-qr.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { GenerateWorkerQrDto } from './dto/generate-worker-qr.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hikCentralQr: HikCentralQrService,
  ) {}

  private async isAdmin(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!admin;
  }

  private async assertUnitAccessCanManageWorkers(userId: string, unitId: string) {
    const access = await getActiveUnitAccess(this.prisma, userId, unitId);
    if (!access.canManageWorkers) {
      throw new ForbiddenException('You do not have permission to manage workers');
    }
    return access;
  }

  private async assertUnitAccessCanGenerateWorkerQr(userId: string, unitId: string) {
    const access = await this.assertUnitAccessCanManageWorkers(userId, unitId);
    if (!access.canGenerateQR) {
      throw new ForbiddenException(
        'You do not have permission to generate QR codes for this unit',
      );
    }
    return access;
  }

  private async assertActiveContractorMember(
    userId: string,
    contractorId: string,
    opts?: { write?: boolean },
  ) {
    const allowedRoles = opts?.write
      ? [ContractorRoleEnum.ADMIN, ContractorRoleEnum.SUPERVISOR]
      : [
          ContractorRoleEnum.ADMIN,
          ContractorRoleEnum.SUPERVISOR,
          ContractorRoleEnum.VIEWER,
        ];

    const member = await this.prisma.contractorMember.findFirst({
      where: {
        userId,
        contractorId,
        status: MemberStatusEnum.ACTIVE,
        role: { in: allowedRoles },
      },
      select: { id: true, role: true },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this contractor');
    }
    return member;
  }

  async createContractor(dto: CreateContractorDto, userId: string) {
    const admin = await this.isAdmin(userId);
    if (!admin) {
      await this.assertUnitAccessCanManageWorkers(userId, dto.unitId);
    }

    const existing = await this.prisma.contractor.findFirst({
      where: { name: dto.name.trim() },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A contractor with this name already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const contractor = await tx.contractor.create({
        data: { name: dto.name.trim(), status: EntityStatus.ACTIVE },
      });
      await tx.contractorMember.create({
        data: {
          contractorId: contractor.id,
          userId,
          role: ContractorRoleEnum.ADMIN,
          status: MemberStatusEnum.ACTIVE,
        },
      });
      return contractor;
    });
  }

  async listContractors(userId: string, unitId?: string) {
    const admin = await this.isAdmin(userId);

    if (!unitId) {
      return this.prisma.contractor.findMany({
        where: {
          members: {
            some: { userId, status: MemberStatusEnum.ACTIVE },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    if (!admin) {
      const access = await getActiveUnitAccess(this.prisma, userId, unitId);
      if (
        access.role !== UnitAccessRole.OWNER &&
        access.role !== UnitAccessRole.DELEGATE
      ) {
        throw new ForbiddenException('Not authorized to view contractors for this unit');
      }
      if (access.role === UnitAccessRole.DELEGATE && !access.canManageWorkers) {
        throw new ForbiddenException('You do not have permission to manage workers');
      }
    }

    const baseWhere = {
      workers: { some: { unitId } },
      status: EntityStatus.ACTIVE,
    } as const;

    if (admin) {
      return this.prisma.contractor.findMany({
        where: baseWhere,
        orderBy: { name: 'asc' },
      });
    }

    const access = await getActiveUnitAccess(this.prisma, userId, unitId);
    if (access.role === UnitAccessRole.OWNER) {
      return this.prisma.contractor.findMany({
        where: baseWhere,
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.contractor.findMany({
      where: {
        ...baseWhere,
        members: { some: { userId, status: MemberStatusEnum.ACTIVE } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createWorker(dto: CreateWorkerDto, userId: string) {
    const admin = await this.isAdmin(userId);
    let access: Awaited<ReturnType<WorkersService['assertUnitAccessCanManageWorkers']>> | null =
      null;
    if (!admin) {
      access = await this.assertUnitAccessCanManageWorkers(userId, dto.unitId);
      if (access.role === UnitAccessRole.DELEGATE) {
        await this.assertActiveContractorMember(userId, dto.contractorId, {
          write: true,
        });
      }
    }

    const contractor = await this.prisma.contractor.findUnique({
      where: { id: dto.contractorId },
      select: { id: true, status: true },
    });
    if (!contractor || contractor.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Contractor is not active');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const nationalId = dto.nationalId.trim();
    const fullName = dto.fullName.trim();

    let accessProfile = await this.prisma.accessProfile.findFirst({
      where: { nationalId },
    });
    if (accessProfile) {
      accessProfile = await this.prisma.accessProfile.update({
        where: { id: accessProfile.id },
        data: {
          fullName,
          phone: dto.phone?.trim() || null,
          photoId: dto.photoId?.trim() || null,
          status: AccessStatus.ACTIVE,
        },
      });
    } else {
      accessProfile = await this.prisma.accessProfile.create({
        data: {
          fullName,
          nationalId,
          phone: dto.phone?.trim(),
          photoId: dto.photoId?.trim(),
          status: AccessStatus.ACTIVE,
        },
      });
    }

    const existingWorker = await this.prisma.worker.findFirst({
      where: {
        unitId: dto.unitId,
        accessProfileId: accessProfile.id,
        status: { in: [EntityStatus.ACTIVE, EntityStatus.SUSPENDED] },
      },
      select: { id: true },
    });
    if (existingWorker) {
      throw new ConflictException('Worker already exists for this unit');
    }

    return this.prisma.worker.create({
      data: {
        unitId: dto.unitId,
        contractorId: dto.contractorId,
        accessProfileId: accessProfile.id,
        jobType: dto.jobType?.trim(),
        status: EntityStatus.ACTIVE,
      },
      include: { accessProfile: true, contractor: true, unit: true },
    });
  }

  async listWorkersForUnit(unitId: string, userId: string) {
    if (!unitId) throw new BadRequestException('unitId is required');

    const admin = await this.isAdmin(userId);
    if (!admin) {
      const access = await getActiveUnitAccess(this.prisma, userId, unitId);
      if (
        access.role !== UnitAccessRole.OWNER &&
        access.role !== UnitAccessRole.DELEGATE
      ) {
        throw new ForbiddenException('Not authorized to view workers for this unit');
      }
      if (access.role === UnitAccessRole.DELEGATE && !access.canManageWorkers) {
        throw new ForbiddenException('You do not have permission to manage workers');
      }
    }

    if (admin) {
      return this.prisma.worker.findMany({
        where: { unitId },
        include: { accessProfile: true, contractor: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    const access = await getActiveUnitAccess(this.prisma, userId, unitId);
    if (access.role === UnitAccessRole.OWNER) {
      return this.prisma.worker.findMany({
        where: { unitId },
        include: { accessProfile: true, contractor: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.worker.findMany({
      where: {
        unitId,
        contractor: {
          members: { some: { userId, status: MemberStatusEnum.ACTIVE } },
        },
      },
      include: { accessProfile: true, contractor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateWorker(workerId: string, dto: UpdateWorkerDto, userId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { accessProfile: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    const admin = await this.isAdmin(userId);
    let access: Awaited<ReturnType<WorkersService['assertUnitAccessCanManageWorkers']>> | null =
      null;
    if (!admin) {
      access = await this.assertUnitAccessCanManageWorkers(userId, worker.unitId);
      if (access.role === UnitAccessRole.DELEGATE) {
        await this.assertActiveContractorMember(userId, worker.contractorId, {
          write: true,
        });
      }
    }

    const accessProfileUpdates: Prisma.AccessProfileUpdateInput = {};
    if (dto.fullName !== undefined) accessProfileUpdates.fullName = dto.fullName.trim();
    if (dto.nationalId !== undefined)
      accessProfileUpdates.nationalId = dto.nationalId.trim();
    if (dto.phone !== undefined)
      accessProfileUpdates.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.photoId !== undefined)
      accessProfileUpdates.photoId = dto.photoId ? dto.photoId.trim() : null;

    const workerUpdates: Prisma.WorkerUpdateInput = {};
    if (dto.jobType !== undefined) workerUpdates.jobType = dto.jobType?.trim() || null;
    if (dto.status !== undefined) workerUpdates.status = dto.status;

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(accessProfileUpdates).length > 0) {
        await tx.accessProfile.update({
          where: { id: worker.accessProfileId },
          data: accessProfileUpdates,
        });
      }

      return tx.worker.update({
        where: { id: workerId },
        data: workerUpdates,
        include: { accessProfile: true, contractor: true, unit: true },
      });
    });
  }

  private computeWorkerValidity(validFrom?: Date, validTo?: Date) {
    const from = validFrom ?? new Date();
    if (validTo) return { validFrom: from, validTo };
    return { validFrom: from, validTo: dayjs(from).add(8, 'hour').toDate() };
  }

  async generateWorkerQr(workerId: string, dto: GenerateWorkerQrDto, userId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: { accessProfile: true, contractor: true, unit: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    if (worker.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Worker is not active');
    }
    if (worker.contractor.status !== EntityStatus.ACTIVE) {
      throw new BadRequestException('Contractor is not active');
    }
    if (worker.accessProfile.status !== AccessStatus.ACTIVE) {
      throw new BadRequestException('Worker access profile is not active');
    }

    const admin = await this.isAdmin(userId);
    let access: Awaited<ReturnType<WorkersService['assertUnitAccessCanGenerateWorkerQr']>> | null =
      null;
    if (!admin) {
      access = await this.assertUnitAccessCanGenerateWorkerQr(userId, worker.unitId);
      if (access.role === UnitAccessRole.DELEGATE) {
        await this.assertActiveContractorMember(userId, worker.contractorId);
      }
    }

    const { validFrom, validTo } = this.computeWorkerValidity(dto.validFrom, dto.validTo);
    if (validTo <= validFrom) {
      throw new BadRequestException('validTo must be after validFrom');
    }

    const gates = dto.gates ?? [];
    const notes =
      dto.notes ??
      `Worker: ${worker.accessProfile.fullName} (${worker.accessProfile.nationalId})`;

    let accessGrantId: string | undefined;
    try {
      const grant = await this.prisma.accessGrant.create({
        data: {
          accessProfileId: worker.accessProfileId,
          unitId: worker.unitId,
          validFrom,
          validTo,
          permissions: [AccessGrantPermission.WORK],
        },
        select: { id: true },
      });
      accessGrantId = grant.id;

      const hik = await this.hikCentralQr.createQrCode({
        unitId: worker.unitId,
        type: QRType.WORKER,
        validFrom,
        validTo,
        visitorName: worker.accessProfile.fullName,
        permissions: [AccessGrantPermission.WORK],
        gates,
        notes,
      });

      const qrCode = await this.prisma.accessQRCode.create({
        data: {
          qrId: hik.qrId,
          type: QRType.WORKER,
          generatedById: userId,
          unitId: worker.unitId,
          accessGrantId,
          visitorName: worker.accessProfile.fullName,
          validFrom,
          validTo,
          status: AccessStatus.ACTIVE,
          gates,
          notes,
        },
      });

      return { qrCode, qrImageBase64: hik.qrImageBase64 };
    } catch (err: unknown) {
      if (accessGrantId) {
        await this.prisma.accessGrant
          .delete({ where: { id: accessGrantId } })
          .catch(() => undefined);
      }
      throw err;
    }
  }
}

