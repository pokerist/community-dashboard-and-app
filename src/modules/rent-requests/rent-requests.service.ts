import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaseStatus, RentRequestStatus, UnitStatus, UserStatusEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { CreateRentRequestDto } from './dto/create-rent-request.dto';
import { ReviewRentRequestDto } from './dto/review-rent-request.dto';

@Injectable()
export class RentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private async assertActiveOwnerAccess(userId: string, unitId: string) {
    const access = await this.prisma.unitAccess.findFirst({
      where: {
        userId,
        unitId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('Only an active owner can create rent requests for this unit');
    }
  }

  private async isAdmin(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return Boolean(admin);
  }

  private generatePassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let i = 0; i < length; i += 1) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    return value;
  }

  async create(ownerUserId: string, dto: CreateRentRequestDto) {
    await this.assertActiveOwnerAccess(ownerUserId, dto.unitId);

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, status: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    const rentableStatuses: UnitStatus[] = [
      UnitStatus.DELIVERED,
      UnitStatus.OCCUPIED,
      UnitStatus.LEASED,
      UnitStatus.RENTED,
    ];
    if (!rentableStatuses.includes(unit.status)) {
      throw new BadRequestException('Unit must be delivered/occupied to submit rent request');
    }

    const activeLease = await this.prisma.lease.findFirst({
      where: {
        unitId: dto.unitId,
        status: LeaseStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      select: { id: true },
    });
    if (activeLease) {
      throw new ConflictException('Unit already has an active lease');
    }

    const contract = await this.prisma.file.findUnique({ where: { id: dto.contractFileId } });
    if (!contract || contract.category !== 'CONTRACT') {
      throw new BadRequestException('contractFileId must point to a CONTRACT file');
    }

    if (dto.tenantNationalIdFileId) {
      const national = await this.prisma.file.findUnique({
        where: { id: dto.tenantNationalIdFileId },
      });
      if (!national || (national.category !== 'NATIONAL_ID' && national.category !== 'DELEGATE_ID')) {
        throw new BadRequestException('tenantNationalIdFileId must point to an ID file');
      }
    }

    return this.prisma.rentRequest.create({
      data: {
        ownerUserId,
        unitId: dto.unitId,
        tenantName: dto.tenantName.trim(),
        tenantEmail: dto.tenantEmail.trim().toLowerCase(),
        tenantPhone: dto.tenantPhone.trim(),
        tenantNationalId: dto.tenantNationalId?.trim() || null,
        tenantNationality: dto.tenantNationality ?? 'EGYPTIAN',
        tenantNationalIdFileId: dto.tenantNationalIdFileId ?? null,
        contractFileId: dto.contractFileId,
      },
      include: {
        unit: { select: { id: true, unitNumber: true, block: true, projectName: true, status: true } },
      },
    });
  }

  async listMy(ownerUserId: string) {
    return this.prisma.rentRequest.findMany({
      where: { ownerUserId },
      include: {
        unit: { select: { id: true, unitNumber: true, block: true, projectName: true, status: true } },
        reviewedBy: { select: { id: true, nameEN: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAdmin(actorUserId: string) {
    if (!(await this.isAdmin(actorUserId))) {
      throw new ForbiddenException('Admin access required');
    }

    return this.prisma.rentRequest.findMany({
      include: {
        owner: { select: { id: true, nameEN: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true, block: true, projectName: true, status: true } },
        reviewedBy: { select: { id: true, nameEN: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(id: string, actorUserId: string, dto: ReviewRentRequestDto) {
    if (!(await this.isAdmin(actorUserId))) {
      throw new ForbiddenException('Admin access required');
    }

    const row = await this.prisma.rentRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Rent request not found');
    if (row.status !== RentRequestStatus.PENDING) {
      throw new BadRequestException('Rent request is no longer pending');
    }

    if (dto.status === RentRequestStatus.REJECTED || dto.status === RentRequestStatus.CANCELLED) {
      return this.prisma.rentRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason?.trim() || null,
        },
      });
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const current = await tx.rentRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Rent request not found');
      if (current.status !== RentRequestStatus.PENDING) {
        throw new BadRequestException('Rent request is no longer pending');
      }

      const activeLease = await tx.lease.findFirst({
        where: {
          unitId: current.unitId,
          status: LeaseStatus.ACTIVE,
          endDate: { gt: new Date() },
        },
        select: { id: true },
      });
      if (activeLease) throw new ConflictException('Unit already has an active lease');

      let tenantUser = await tx.user.findUnique({
        where: { email: current.tenantEmail },
        select: { id: true, nationalIdFileId: true },
      });

      let rawPassword: string | null = null;
      if (!tenantUser) {
        rawPassword = this.generatePassword();
        const passwordHash = await bcrypt.hash(rawPassword, 12);
        tenantUser = await tx.user.create({
          data: {
            email: current.tenantEmail,
            phone: current.tenantPhone,
            nameEN: current.tenantName,
            nationalIdFileId: current.tenantNationalIdFileId,
            userStatus: UserStatusEnum.ACTIVE,
            signupSource: 'dashboard',
            passwordHash,
          },
          select: { id: true, nationalIdFileId: true },
        });
      }

      if (!tenantUser.nationalIdFileId && current.tenantNationalIdFileId) {
        await tx.user.update({
          where: { id: tenantUser.id },
          data: { nationalIdFileId: current.tenantNationalIdFileId },
        });
      }

      const tenantProfile = await tx.tenant.findUnique({
        where: { userId: tenantUser.id },
        select: { id: true },
      });
      if (!tenantProfile) {
        await tx.tenant.create({ data: { userId: tenantUser.id } });
      }

      const residentProfile = await tx.resident.findUnique({
        where: { userId: tenantUser.id },
        select: { id: true, nationalId: true },
      });
      if (!residentProfile) {
        await tx.resident.create({
          data: {
            userId: tenantUser.id,
            nationalId: current.tenantNationalId ?? null,
          },
        });
      }

      const lease = await tx.lease.create({
        data: {
          unitId: current.unitId,
          ownerId: current.ownerUserId,
          tenantId: tenantUser.id,
          tenantEmail: current.tenantEmail,
          tenantNationalId: current.tenantNationalId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          monthlyRent: 0,
          contractFileId: current.contractFileId,
          status: LeaseStatus.ACTIVE,
          source: 'OWNER',
        },
      });

      const existingTenantAccess = await tx.unitAccess.findFirst({
        where: {
          unitId: current.unitId,
          userId: tenantUser.id,
          role: 'TENANT',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (!existingTenantAccess) {
        await tx.unitAccess.create({
          data: {
            unitId: current.unitId,
            userId: tenantUser.id,
            role: 'TENANT',
            startsAt: new Date(),
            grantedBy: actorUserId,
            status: 'ACTIVE',
            source: 'TENANT_AUTO',
            canViewFinancials: true,
            canReceiveBilling: true,
            canBookFacilities: true,
            canGenerateQR: true,
            canManageWorkers: false,
          },
        });
      }

      await tx.unitAccess.updateMany({
        where: {
          unitId: current.unitId,
          userId: current.ownerUserId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        data: {
          canViewFinancials: true,
          canReceiveBilling: false,
        },
      });

      await tx.unit.update({
        where: { id: current.unitId },
        data: { status: UnitStatus.RENTED },
      });

      const updated = await tx.rentRequest.update({
        where: { id: current.id },
        data: {
          status: RentRequestStatus.APPROVED,
          reviewedById: actorUserId,
          reviewedAt: new Date(),
          approvedLeaseId: lease.id,
          rejectionReason: null,
        },
      });

      return {
        updated,
        rawPassword,
        tenantEmail: current.tenantEmail,
        tenantName: current.tenantName,
      };
    });

    if (approved.rawPassword && approved.tenantEmail) {
      try {
        await this.emailService.sendEmail(
          'Your tenant account is ready',
          approved.tenantEmail,
          `<p>Hello ${approved.tenantName}, your account has been created.</p><p>Email: ${approved.tenantEmail}</p><p>Password: ${approved.rawPassword}</p>`,
        );
      } catch {
        // best effort only
      }
    }

    return approved.updated;
  }
}
