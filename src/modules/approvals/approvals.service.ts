import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  AccessStatus,
  ApprovalDeliveryStatus,
  HouseholdRequestStatus,
  OwnerPaymentMode,
  Prisma,
  RegistrationStatus,
  RentRequestStatus,
  UserStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { HouseholdService } from '../household/household.service';
import { EmailService } from '../notifications/email.service';
import { SmsProviderService } from '../notifications/providers/sms-provider.service';
import {
  ListPendingDelegatesQueryDto,
  ListPendingFamilyMembersQueryDto,
  ListPendingHomeStaffQueryDto,
  ListPendingOwnersQueryDto,
} from './dto/approval-query.dto';
import {
  ApprovalActionResponseDto,
  ApprovalDocumentOtherDto,
  ApprovalDocumentsDto,
  ApprovalStatsResponseDto,
  DelegateApprovalItemResponseDto,
  FamilyApprovalItemResponseDto,
  HomeStaffApprovalItemResponseDto,
  OwnerApprovalItemResponseDto,
  PreRegistrationResponseDto,
} from './dto/approval-response.dto';
import { PreRegisterFamilyMemberDto } from './dto/pre-register-family-member.dto';
import { PreRegisterOwnerDto } from './dto/pre-register-owner.dto';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly householdService: HouseholdService,
    private readonly emailService: EmailService,
    private readonly smsProvider: SmsProviderService,
  ) {}

  private resolveFileUrl(fileId?: string | null): string | null {
    if (!fileId) return null;
    const baseUrl = (
      process.env.API_PUBLIC_BASE_URL ??
      process.env.BACKEND_PUBLIC_URL ??
      ''
    )
      .trim()
      .replace(/\/+$/, '');
    return baseUrl ? `${baseUrl}/files/${fileId}/stream` : `/files/${fileId}/stream`;
  }

  private parseLookup(value: Prisma.JsonValue | null): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as JsonRecord;
  }

  private parseNullableLookup(value: Prisma.JsonValue | null): JsonRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
  }

  private toJson(value: JsonRecord): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private buildCreatedAtFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    const filter: Prisma.DateTimeFilter = {};
    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      if (!dateTo.includes('T')) end.setHours(23, 59, 59, 999);
      filter.lte = end;
    }
    return filter.gte || filter.lte ? filter : undefined;
  }

  private ownerIsPreRegistered(origin: string, lookupResult: Prisma.JsonValue | null): boolean {
    const lookup = this.parseLookup(lookupResult);
    return origin.toLowerCase().includes('pre') || lookup.isPreRegistration === true;
  }

  private createDocuments(
    photo?: string | null,
    nationalId?: string | null,
    passport?: string | null,
    other: Array<{ label: string; fileId?: string | null }> = [],
  ): ApprovalDocumentsDto {
    const resolvedOther: ApprovalDocumentOtherDto[] = other
      .filter((row) => Boolean(row.fileId))
      .map((row) => ({
        label: row.label,
        url: this.resolveFileUrl(row.fileId) as string,
      }));
    return {
      photo: this.resolveFileUrl(photo),
      nationalId: this.resolveFileUrl(nationalId),
      passport: this.resolveFileUrl(passport),
      other: resolvedOther,
    };
  }

  private normalizeEmail(email?: string | null): string | null {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return normalized || null;
  }

  private normalizePhone(phone: string): string {
    const normalized = phone.trim();
    if (!normalized) throw new BadRequestException('Phone is required');
    return normalized;
  }

  private randomPassword(length = 12): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let output = '';
    for (let index = 0; index < length; index += 1) {
      output += chars[Math.floor(Math.random() * chars.length)];
    }
    return output;
  }

  private async ensureCommunityRole(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const role = await tx.role.findUnique({
      where: { name: 'COMMUNITY_USER' },
      select: { id: true },
    });
    if (!role) return;
    await tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async assignOwnerUnit(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      residentId: string;
      unitId: string;
      adminId: string;
      notes?: string;
    },
  ): Promise<void> {
    const unit = await tx.unit.findUnique({
      where: { id: params.unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const existingPrimaryForUnit = await tx.residentUnit.findFirst({
      where: { unitId: params.unitId, isPrimary: true },
      select: { residentId: true },
    });
    if (
      existingPrimaryForUnit &&
      existingPrimaryForUnit.residentId !== params.residentId
    ) {
      throw new ConflictException('Unit already has a primary owner');
    }

    const hasPrimaryForResident = await tx.residentUnit.findFirst({
      where: { residentId: params.residentId, isPrimary: true },
      select: { id: true },
    });
    const residentUnit = await tx.residentUnit.findUnique({
      where: {
        residentId_unitId: {
          residentId: params.residentId,
          unitId: params.unitId,
        },
      },
      select: { id: true, isPrimary: true },
    });
    const shouldBePrimary =
      !hasPrimaryForResident ||
      existingPrimaryForUnit?.residentId === params.residentId;

    if (!residentUnit) {
      await tx.residentUnit.create({
        data: {
          residentId: params.residentId,
          unitId: params.unitId,
          isPrimary: shouldBePrimary,
        },
      });
    } else if (!residentUnit.isPrimary && shouldBePrimary) {
      await tx.residentUnit.update({
        where: {
          residentId_unitId: {
            residentId: params.residentId,
            unitId: params.unitId,
          },
        },
        data: { isPrimary: true },
      });
    }

    const ownerAccess = await tx.unitAccess.findFirst({
      where: {
        unitId: params.unitId,
        userId: params.userId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!ownerAccess) {
      await tx.unitAccess.create({
        data: {
          unitId: params.unitId,
          userId: params.userId,
          role: 'OWNER',
          startsAt: new Date(),
          grantedBy: params.adminId,
          status: 'ACTIVE',
          source: 'ADMIN_ASSIGNMENT',
          canViewFinancials: true,
          canReceiveBilling: true,
          canBookFacilities: true,
          canGenerateQR: true,
          canManageWorkers: true,
        },
      });
    }

    const notes = params.notes?.trim();
    await tx.ownerUnitContract.upsert({
      where: {
        ownerUserId_unitId: {
          ownerUserId: params.userId,
          unitId: params.unitId,
        },
      },
      create: {
        ownerUserId: params.userId,
        unitId: params.unitId,
        paymentMode: OwnerPaymentMode.CASH,
        notes: notes || undefined,
        createdById: params.adminId,
      },
      update: {
        archivedAt: null,
        notes: notes || undefined,
      },
    });
  }

  async getApprovalStats(): Promise<ApprovalStatsResponseDto> {
    const [
      pendingOwners,
      pendingFamilyMembers,
      pendingDelegates,
      pendingHomeStaff,
      pendingTenants,
    ] = await Promise.all([
      this.prisma.pendingRegistration.count({
        where: {
          roleIntent: 'OWNER',
          status: { in: [RegistrationStatus.PENDING, RegistrationStatus.PROCESSING] },
        },
      }),
      this.prisma.familyAccessRequest.count({
        where: { status: HouseholdRequestStatus.PENDING },
      }),
      this.prisma.authorizedAccessRequest.count({
        where: { status: HouseholdRequestStatus.PENDING },
      }),
      this.prisma.homeStaffAccess.count({
        where: { status: HouseholdRequestStatus.PENDING },
      }),
      this.prisma.rentRequest.count({
        where: { status: RentRequestStatus.PENDING },
      }),
    ]);

    return {
      pendingOwners,
      pendingFamilyMembers,
      pendingDelegates,
      pendingHomeStaff,
      pendingTenants,
      totalPending:
        pendingOwners +
        pendingFamilyMembers +
        pendingDelegates +
        pendingHomeStaff +
        pendingTenants,
    };
  }

  async listPendingOwners(query: ListPendingOwnersQueryDto): Promise<OwnerApprovalItemResponseDto[]> {
    const createdAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
    const where: Prisma.PendingRegistrationWhereInput = {
      roleIntent: 'OWNER',
      ...(createdAt ? { createdAt } : {}),
    };

    where.status =
      !query.status || query.status === 'ALL'
        ? { in: [RegistrationStatus.PENDING, RegistrationStatus.PROCESSING] }
        : query.status;

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.pendingRegistration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rows
      .filter((row) => {
        if (!query.registrationType) return true;
        const isPre = this.ownerIsPreRegistered(row.origin, row.lookupResult);
        return query.registrationType === 'PRE_REG' ? isPre : !isPre;
      })
      .map((row) => {
        const lookup = this.parseNullableLookup(row.lookupResult);
        // Prefer dedicated field; fall back to legacy lookupResult for backwards compat
        const nationalIdFileId =
          row.nationalIdFileId ??
          (lookup && typeof lookup.nationalIdFileId === 'string'
            ? lookup.nationalIdFileId
            : null);
        return {
          id: row.id,
          type: 'OWNER',
          status: row.status,
          submittedAt: row.createdAt.toISOString(),
          isPreRegistration: this.ownerIsPreRegistered(row.origin, row.lookupResult),
          documents: this.createDocuments(row.personalPhotoId, nationalIdFileId),
          name: row.name ?? null,
          phone: row.phone,
          email: row.email ?? null,
          nationalId: row.nationalId,
          roleIntent: row.roleIntent ?? null,
          origin: row.origin,
          expiresAt: row.expiresAt.toISOString(),
          verificationCode: row.verificationCode ?? null,
          photoUrl: this.resolveFileUrl(row.personalPhotoId),
          nationalIdFileUrl: this.resolveFileUrl(nationalIdFileId),
          lookupResult: lookup,
        };
      });
  }

  async listPendingFamilyMembers(
    query: ListPendingFamilyMembersQueryDto,
  ): Promise<FamilyApprovalItemResponseDto[]> {
    const createdAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
    const where: Prisma.FamilyAccessRequestWhereInput = {
      status: query.status ?? HouseholdRequestStatus.PENDING,
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.relationship ? { relationship: query.relationship } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { owner: { nameEN: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.familyAccessRequest.findMany({
      where,
      include: {
        owner: { select: { id: true, nameEN: true, email: true } },
        unit: { select: { id: true, unitNumber: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      type: 'FAMILY',
      status: row.status,
      submittedAt: row.createdAt.toISOString(),
      isPreRegistration: row.isPreRegistration,
      documents: this.createDocuments(
        row.personalPhotoFileId,
        row.nationalIdFileId,
        row.passportFileId,
        [
          { label: 'Birth Certificate', fileId: row.birthCertificateFileId },
          { label: 'Marriage Certificate', fileId: row.marriageCertificateFileId },
        ],
      ),
      fullName: row.fullName,
      phone: row.phone,
      email: row.email ?? null,
      relationship: row.relationship,
      ownerUserId: row.ownerUserId,
      ownerName: row.owner.nameEN ?? row.owner.email ?? row.owner.id,
      unitId: row.unitId,
      unitNumber: row.unit.unitNumber ?? null,
      projectName: row.unit.projectName,
      nationality: row.nationality,
      nationalIdOrPassport: row.nationalIdOrPassport ?? null,
      featurePermissions:
        row.featurePermissions &&
        typeof row.featurePermissions === 'object' &&
        !Array.isArray(row.featurePermissions)
          ? (row.featurePermissions as JsonRecord)
          : null,
    }));
  }

  async listPendingDelegates(
    query: ListPendingDelegatesQueryDto,
  ): Promise<DelegateApprovalItemResponseDto[]> {
    const createdAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
    const where: Prisma.AuthorizedAccessRequestWhereInput = {
      status: query.status ?? HouseholdRequestStatus.PENDING,
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.feeMode ? { feeMode: query.feeMode } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { owner: { nameEN: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.authorizedAccessRequest.findMany({
      where,
      include: {
        owner: { select: { id: true, nameEN: true, email: true } },
        unit: { select: { id: true, unitNumber: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      type: 'DELEGATE',
      status: row.status,
      submittedAt: row.createdAt.toISOString(),
      isPreRegistration: false,
      documents: this.createDocuments(
        row.personalPhotoFileId,
        row.idOrPassportFileId,
        row.nationality === 'FOREIGN' ? row.idOrPassportFileId : null,
        [{ label: 'Power of Attorney', fileId: row.powerOfAttorneyFileId }],
      ),
      fullName: row.fullName,
      phone: row.phone,
      email: row.email ?? null,
      ownerUserId: row.ownerUserId,
      ownerName: row.owner.nameEN ?? row.owner.email ?? row.owner.id,
      unitId: row.unitId,
      unitNumber: row.unit.unitNumber ?? null,
      projectName: row.unit.projectName,
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo.toISOString(),
      qrScopes: row.qrScopes,
      feeMode: row.feeMode,
      feeAmount: row.feeAmount === null ? null : Number(row.feeAmount),
      featurePermissions:
        row.featurePermissions &&
        typeof row.featurePermissions === 'object' &&
        !Array.isArray(row.featurePermissions)
          ? (row.featurePermissions as JsonRecord)
          : null,
    }));
  }

  async listPendingHomeStaff(
    query: ListPendingHomeStaffQueryDto,
  ): Promise<HomeStaffApprovalItemResponseDto[]> {
    const createdAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
    const where: Prisma.HomeStaffAccessWhereInput = {
      status: query.status ?? HouseholdRequestStatus.PENDING,
      ...(query.staffType ? { staffType: query.staffType } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { owner: { nameEN: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.homeStaffAccess.findMany({
      where,
      include: {
        owner: { select: { id: true, nameEN: true, email: true } },
        unit: { select: { id: true, unitNumber: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      type: 'HOME_STAFF',
      status: row.status,
      submittedAt: row.createdAt.toISOString(),
      isPreRegistration: row.isPreRegistration,
      documents: this.createDocuments(
        row.personalPhotoFileId,
        row.idOrPassportFileId,
        row.nationality === 'FOREIGN' ? row.idOrPassportFileId : null,
      ),
      fullName: row.fullName,
      phone: row.phone,
      ownerUserId: row.ownerUserId,
      ownerName: row.owner.nameEN ?? row.owner.email ?? row.owner.id,
      unitId: row.unitId,
      unitNumber: row.unit.unitNumber ?? null,
      projectName: row.unit.projectName,
      staffType: row.staffType,
      accessValidFrom: row.accessValidFrom.toISOString(),
      accessValidTo: row.accessValidTo.toISOString(),
      isLiveIn: row.isLiveIn,
      employmentFrom: row.employmentFrom?.toISOString() ?? null,
      employmentTo: row.employmentTo?.toISOString() ?? null,
    }));
  }

  private async sendCredentialsEmail(params: {
    email: string;
    fullName: string;
    password: string;
    intro: string;
  }): Promise<{ status: ApprovalDeliveryStatus; sentAt: Date | null; error: string | null }> {
    const loginUrl = `${process.env.FRONTEND_URL || 'https://app.alkarma.com'}/login`;
    const html = `
      <h2>Hello ${params.fullName},</h2>
      <p>${params.intro}</p>
      <p><strong>Email:</strong> ${params.email}</p>
      <p><strong>Password:</strong> ${params.password}</p>
      <p>Login URL: <a href="${loginUrl}">${loginUrl}</a></p>
    `;

    try {
      await this.emailService.sendEmail('Community Access Credentials', params.email, html);
      return {
        status: ApprovalDeliveryStatus.SENT,
        sentAt: new Date(),
        error: null,
      };
    } catch (error: unknown) {
      return {
        status: ApprovalDeliveryStatus.FAILED,
        sentAt: null,
        error: error instanceof Error ? error.message : 'Email delivery failed',
      };
    }
  }

  private async sendCredentialsSms(params: {
    phone: string;
    password: string;
    intro: string;
  }): Promise<void> {
    const loginUrl = `${process.env.FRONTEND_URL || 'https://app.alkarma.com'}/login`;
    await this.smsProvider.sendSms({
      to: params.phone,
      body: `${params.intro}\nLogin: ${loginUrl}\nPassword: ${params.password}`,
    });
  }

  async approveOwnerRegistration(id: string, adminId: string): Promise<ApprovalActionResponseDto> {
    const provisioned = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.pendingRegistration.findUnique({ where: { id } });
      if (!pending) throw new NotFoundException('Pending owner registration not found');
      if (
        pending.status !== RegistrationStatus.PENDING &&
        pending.status !== RegistrationStatus.PROCESSING
      ) {
        throw new BadRequestException('Only pending or processing records can be approved');
      }

      const email = this.normalizeEmail(pending.email);
      const phone = this.normalizePhone(pending.phone);
      const password = this.randomPassword();
      const passwordHash = await bcrypt.hash(password, 12);

      const byEmail = email
        ? await tx.user.findUnique({ where: { email }, select: { id: true } })
        : null;
      const byPhone = await tx.user.findFirst({
        where: { phone },
        select: { id: true, email: true },
      });

      if (byEmail && byPhone && byEmail.id !== byPhone.id) {
        throw new ConflictException('Email and phone belong to different users');
      }

      const userId = byEmail?.id ?? byPhone?.id ?? null;
      const user =
        userId === null
          ? await tx.user.create({
              data: {
                nameEN: pending.name?.trim() || undefined,
                email: email ?? undefined,
                phone,
                profilePhotoId: pending.personalPhotoId,
                passwordHash,
                userStatus: UserStatusEnum.ACTIVE,
                signupSource: pending.origin,
                requiresOnboarding: false,
                onboardingCompletedAt: new Date(),
                onboardingStep: 'COMPLETE',
              },
              select: { id: true },
            })
          : await tx.user.update({
              where: { id: userId },
              data: {
                nameEN: pending.name?.trim() || undefined,
                email: email ?? undefined,
                phone,
                profilePhotoId: pending.personalPhotoId,
                passwordHash,
                userStatus: UserStatusEnum.ACTIVE,
                requiresOnboarding: false,
                onboardingCompletedAt: new Date(),
                onboardingStep: 'COMPLETE',
              },
              select: { id: true },
            });

      await tx.owner.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });

      await tx.resident.upsert({
        where: { userId: user.id },
        create: { userId: user.id, nationalId: pending.nationalId },
        update: { nationalId: pending.nationalId },
      });

      await this.ensureCommunityRole(tx, user.id);

      const updated = await tx.pendingRegistration.update({
        where: { id: pending.id },
        data: {
          status: RegistrationStatus.VERIFIED,
          lookupResult: this.toJson({
            ...this.parseLookup(pending.lookupResult),
            approvedById: adminId,
            approvedAt: new Date().toISOString(),
          }),
        },
        select: { id: true, status: true },
      });

      return {
        id: updated.id,
        status: updated.status,
        email,
        phone,
        fullName: pending.name?.trim() || 'Owner',
        password,
      };
    });

    if (provisioned.email) {
      await this.sendCredentialsEmail({
        email: provisioned.email,
        fullName: provisioned.fullName,
        password: provisioned.password,
        intro: 'Your owner registration has been approved.',
      });
    } else {
      await this.sendCredentialsSms({
        phone: provisioned.phone,
        password: provisioned.password,
        intro: 'Your owner registration has been approved.',
      });
    }

    return { success: true, id: provisioned.id, status: provisioned.status };
  }

  async rejectOwnerRegistration(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<ApprovalActionResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const pending = await tx.pendingRegistration.findUnique({ where: { id } });
      if (!pending) throw new NotFoundException('Pending owner registration not found');
      if (
        pending.status === RegistrationStatus.VERIFIED ||
        pending.status === RegistrationStatus.REJECTED
      ) {
        throw new BadRequestException('Owner registration is already processed');
      }

      return tx.pendingRegistration.update({
        where: { id: pending.id },
        data: {
          status: RegistrationStatus.REJECTED,
          lookupResult: this.toJson({
            ...this.parseLookup(pending.lookupResult),
            rejectedById: adminId,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason,
          }),
        },
        select: { id: true, status: true },
      });
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async approveFamilyMember(id: string, adminId: string): Promise<ApprovalActionResponseDto> {
    const approved = await this.householdService.reviewFamilyRequest(id, adminId, {
      status: HouseholdRequestStatus.APPROVED,
    });

    const row = await this.prisma.familyAccessRequest.findUnique({
      where: { id: approved.id },
      include: {
        activatedUser: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    if (!row) throw new NotFoundException('Family request not found after approval');
    if (!row.email && row.activatedUser?.id && row.activatedUser.phone) {
      const tempPassword = this.randomPassword();
      await this.prisma.user.update({
        where: { id: row.activatedUser.id },
        data: {
          passwordHash: await bcrypt.hash(tempPassword, 12),
        },
      });
      await this.sendCredentialsSms({
        phone: row.activatedUser.phone,
        password: tempPassword,
        intro: 'Your family member account has been approved.',
      });
      await this.prisma.familyAccessRequest.update({
        where: { id: row.id },
        data: {
          credentialsEmailStatus: ApprovalDeliveryStatus.PENDING,
          credentialsEmailError: 'Credentials delivered via SMS',
        },
      });
    }

    return { success: true, id: row.id, status: row.status };
  }

  async rejectFamilyMember(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<ApprovalActionResponseDto> {
    const rejected = await this.householdService.reviewFamilyRequest(id, adminId, {
      status: HouseholdRequestStatus.REJECTED,
      rejectionReason: reason,
    });
    return { success: true, id: rejected.id, status: rejected.status };
  }

  async approveDelegate(id: string, adminId: string): Promise<ApprovalActionResponseDto> {
    const approved = await this.householdService.reviewAuthorizedRequest(id, adminId, {
      status: HouseholdRequestStatus.APPROVED,
    });
    return { success: true, id: approved.id, status: approved.status };
  }

  async rejectDelegate(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<ApprovalActionResponseDto> {
    const rejected = await this.householdService.reviewAuthorizedRequest(id, adminId, {
      status: HouseholdRequestStatus.REJECTED,
      rejectionReason: reason,
    });
    return { success: true, id: rejected.id, status: rejected.status };
  }

  async approveHomeStaff(id: string, adminId: string): Promise<ApprovalActionResponseDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.homeStaffAccess.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Home staff request not found');
      if (row.status !== HouseholdRequestStatus.PENDING) {
        throw new BadRequestException('Only pending home staff requests can be approved');
      }

      let contractor = await tx.contractor.findFirst({
        where: { name: 'HOME_STAFF_AUTO' },
        select: { id: true },
      });
      if (!contractor) {
        contractor = await tx.contractor.create({
          data: { name: 'HOME_STAFF_AUTO', status: 'ACTIVE' },
          select: { id: true },
        });
      }

      const profile = await tx.accessProfile.create({
        data: {
          fullName: row.fullName,
          nationalId: row.nationalIdOrPassport || `HOME_STAFF_${row.id}`,
          phone: row.phone,
          photoId: row.personalPhotoFileId ?? undefined,
          status: AccessStatus.ACTIVE,
        },
        select: { id: true },
      });

      const worker = await tx.worker.create({
        data: {
          accessProfileId: profile.id,
          contractorId: contractor.id,
          unitId: row.unitId,
          jobType: row.staffType,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      return tx.homeStaffAccess.update({
        where: { id: row.id },
        data: {
          status: HouseholdRequestStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: null,
          workerId: worker.id,
        },
        select: { id: true, status: true },
      });
    });

    return { success: true, id: updated.id, status: updated.status };
  }

  async rejectHomeStaff(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<ApprovalActionResponseDto> {
    const row = await this.prisma.homeStaffAccess.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!row) throw new NotFoundException('Home staff request not found');
    if (row.status !== HouseholdRequestStatus.PENDING) {
      throw new BadRequestException('Only pending home staff requests can be rejected');
    }

    const updated = await this.prisma.homeStaffAccess.update({
      where: { id },
      data: {
        status: HouseholdRequestStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      select: { id: true, status: true },
    });
    return { success: true, id: updated.id, status: updated.status };
  }

  private async createPlaceholderPhoto(
    tx: Prisma.TransactionClient,
    scope: string,
  ): Promise<string> {
    const key = `pre-registration/${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const file = await tx.file.create({
      data: {
        key,
        name: `${scope}.jpg`,
        mimeType: 'image/jpeg',
        size: 0,
        category: 'PROFILE_PHOTO',
      },
      select: { id: true },
    });
    return file.id;
  }

  async preRegisterOwner(
    dto: PreRegisterOwnerDto,
    adminId: string,
  ): Promise<PreRegistrationResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    const password = this.randomPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const byEmail = email
        ? await tx.user.findUnique({ where: { email }, select: { id: true } })
        : null;
      const byPhone = await tx.user.findFirst({
        where: { phone },
        select: { id: true, email: true },
      });

      if (byEmail && byPhone && byEmail.id !== byPhone.id) {
        throw new ConflictException('Email and phone belong to different users');
      }

      const userId = byEmail?.id ?? byPhone?.id ?? null;
      const user =
        userId === null
          ? await tx.user.create({
              data: {
                nameEN: dto.nameEN.trim(),
                email: email ?? undefined,
                phone,
                passwordHash,
                userStatus: UserStatusEnum.INVITED,
                signupSource: 'dashboard',
                requiresOnboarding: true,
                onboardingCompletedAt: null,
                onboardingStep: 'OTP',
              },
              select: { id: true },
            })
          : await tx.user.update({
              where: { id: userId },
              data: {
                nameEN: dto.nameEN.trim(),
                email: email ?? undefined,
                phone,
                passwordHash,
                userStatus: UserStatusEnum.INVITED,
                requiresOnboarding: true,
                onboardingCompletedAt: null,
                onboardingStep: 'OTP',
              },
              select: { id: true },
            });

      await tx.owner.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      const resident = await tx.resident.upsert({
        where: { userId: user.id },
        create: { userId: user.id, nationalId: dto.nationalId.trim() },
        update: { nationalId: dto.nationalId.trim() },
      });
      await this.ensureCommunityRole(tx, user.id);

      if (dto.unitId) {
        await this.assignOwnerUnit(tx, {
          userId: user.id,
          residentId: resident.id,
          unitId: dto.unitId,
          adminId,
          notes: dto.notes,
        });
      }

      const personalPhotoId = await this.createPlaceholderPhoto(tx, `owner-${user.id}`);
      await tx.user.update({
        where: { id: user.id },
        data: { profilePhotoId: personalPhotoId },
      });

      return {
        userId: user.id,
        requestId: user.id,
        status: RegistrationStatus.VERIFIED as RegistrationStatus,
      };
    });

    if (email) {
      await this.sendCredentialsEmail({
        email,
        fullName: dto.nameEN.trim(),
        password,
        intro: 'Your owner account has been pre-registered.',
      });
    } else {
      await this.sendCredentialsSms({
        phone,
        password,
        intro: 'Your owner account has been pre-registered.',
      });
    }

    return { success: true, ...created };
  }

  async preRegisterFamilyMember(
    dto: PreRegisterFamilyMemberDto,
    adminId: string,
  ): Promise<PreRegistrationResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    const fullName = dto.fullName.trim();
    const preRegistrationPassword = this.randomPassword();
    const preRegistrationPasswordHash = await bcrypt.hash(preRegistrationPassword, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { id: dto.ownerUserId },
        select: { id: true },
      });
      if (!owner) throw new NotFoundException('Owner user not found');

      const unit = await tx.unit.findUnique({
        where: { id: dto.unitId },
        select: { id: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');

      const byEmail = email
        ? await tx.user.findUnique({ where: { email }, select: { id: true } })
        : null;
      const byPhone = await tx.user.findFirst({
        where: { phone },
        select: { id: true, email: true },
      });

      if (byEmail && byPhone && byEmail.id !== byPhone.id) {
        throw new ConflictException('Email and phone belong to different users');
      }

      const userId = byEmail?.id ?? byPhone?.id ?? null;
      const user =
        userId === null
          ? await tx.user.create({
              data: {
                nameEN: fullName,
                email: email ?? undefined,
                phone,
                passwordHash: preRegistrationPasswordHash,
                userStatus: UserStatusEnum.INVITED,
                signupSource: 'dashboard',
                requiresOnboarding: true,
                onboardingCompletedAt: null,
                onboardingStep: 'OTP',
              },
              select: { id: true },
            })
          : await tx.user.update({
              where: { id: userId },
              data: {
                nameEN: fullName,
                email: email ?? undefined,
                phone,
                passwordHash: preRegistrationPasswordHash,
                userStatus: UserStatusEnum.INVITED,
                requiresOnboarding: true,
                onboardingCompletedAt: null,
                onboardingStep: 'OTP',
              },
              select: { id: true },
            });

      await this.ensureCommunityRole(tx, user.id);
      const personalPhotoId = await this.createPlaceholderPhoto(tx, `family-${user.id}`);
      await tx.user.update({
        where: { id: user.id },
        data: { profilePhotoId: personalPhotoId },
      });

      const request = await tx.familyAccessRequest.create({
        data: {
          ownerUserId: dto.ownerUserId,
          unitId: dto.unitId,
          status: HouseholdRequestStatus.PENDING,
          preRegisteredById: adminId,
          isPreRegistration: true,
          relationship: dto.relationship,
          fullName,
          email: email ?? undefined,
          phone,
          nationality: 'EGYPTIAN',
          nationalIdOrPassport: dto.nationalIdOrPassport?.trim() || null,
          personalPhotoFileId: personalPhotoId,
          featurePermissions: this.toJson({
            source: 'pre_registration',
            notes: dto.notes ?? null,
          }),
          activatedUserId: user.id,
        },
        select: { id: true, status: true },
      });

      return { userId: user.id, requestId: request.id, status: request.status };
    });

    const approved = await this.approveFamilyMember(created.requestId, adminId);
    return {
      success: true,
      userId: created.userId,
      requestId: created.requestId,
      status: approved.status,
    };
  }
}
