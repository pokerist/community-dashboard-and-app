import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  ApprovalDeliveryStatus,
  AuthorizedFeeMode,
  FamilyRelationType,
  HouseholdRequestStatus,
  NationalityType,
  OwnerPaymentMode,
  Prisma,
  UserStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { EmailService } from '../notifications/email.service';
import {
  CreateAuthorizedRequestDto,
  CreateFamilyRequestDto,
  CreateHomeStaffDto,
  ReviewHouseholdRequestDto,
} from './dto/household-requests.dto';

@Injectable()
export class HouseholdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly emailService: EmailService,
  ) {}

  private async assertUnitAccess(ownerUserId: string, unitId: string) {
    const access = await this.prisma.unitAccess.findFirst({
      where: {
        userId: ownerUserId,
        unitId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'TENANT'] },
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('No active owner/tenant access for this unit');
    }
  }

  private validateFamilyRequest(dto: CreateFamilyRequestDto) {
    if (!Object.values(FamilyRelationType).includes(dto.relationship)) {
      throw new BadRequestException('Only first-degree family relationships are allowed');
    }

    const nationality = dto.nationality ?? NationalityType.EGYPTIAN;
    if (nationality === NationalityType.FOREIGN && !dto.passportFileId) {
      throw new BadRequestException('Passport document is required for foreign family members');
    }

    if (nationality === NationalityType.EGYPTIAN) {
      const isChild = dto.relationship === FamilyRelationType.SON_DAUGHTER;
      if (isChild && dto.childAgeBracket === '<16' && !dto.birthCertificateFileId) {
        throw new BadRequestException('Birth certificate is required for children under 16');
      }
      if ((!isChild || dto.childAgeBracket !== '<16') && !dto.nationalIdFileId) {
        throw new BadRequestException('National ID document is required');
      }
    }

    if (dto.relationship === FamilyRelationType.SPOUSE && !dto.marriageCertificateFileId) {
      throw new BadRequestException('Marriage certificate is required for spouse requests');
    }
  }

  private relationshipToFamilyMemberType(relationship: FamilyRelationType) {
    if (relationship === FamilyRelationType.SON_DAUGHTER) return 'CHILD' as const;
    if (relationship === FamilyRelationType.MOTHER_FATHER) return 'PARENT' as const;
    return 'SPOUSE' as const;
  }

  private buildAuthorizedCapabilities(
    featurePermissions: Record<string, unknown> | null,
    qrScopes: string[],
  ) {
    const flags = featurePermissions ?? {};
    const hasScope = (key: string) =>
      Boolean(flags[key]) ||
      qrScopes.some((scope) => scope.toLowerCase() === key.toLowerCase());

    const canGenerateQR =
      hasScope('qrdelivery') ||
      hasScope('qrworkers') ||
      hasScope('qrdriver') ||
      hasScope('qrvisitor');

    const canBookFacilities = Boolean(flags.bookings);
    const canViewFinancials = Boolean(flags.utilityPayment || flags.violations);
    const canReceiveBilling = canViewFinancials;
    const canManageWorkers = Boolean(flags.qrWorkers || flags.workers || hasScope('qrworkers'));

    return {
      canGenerateQR,
      canBookFacilities,
      canViewFinancials,
      canReceiveBilling,
      canManageWorkers,
    };
  }

  private buildFamilyCapabilities(featurePermissions: Record<string, unknown> | null) {
    const flags = featurePermissions ?? {};
    return {
      canBookFacilities: Boolean(flags.bookings ?? true),
      canGenerateQR: Boolean(flags.qrVisitor || flags.qrDelivery || flags.qrDriver || flags.qrWorkers),
      canViewFinancials: Boolean(flags.utilityPayment || flags.violations),
      canReceiveBilling: Boolean(flags.utilityPayment || flags.violations),
      canManageWorkers: Boolean(flags.qrWorkers || flags.workers),
    };
  }

  private generateRandomPassword(length = 12) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPassword = '';
    for (let i = 0; i < length; i += 1) {
      randomPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    return randomPassword;
  }

  private async ensureCommunityRole(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const communityRole = await tx.role.findUnique({
      where: { name: 'COMMUNITY_USER' },
      select: { id: true },
    });
    if (!communityRole) return;

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: communityRole.id,
        },
      },
      create: {
        userId,
        roleId: communityRole.id,
      },
      update: {},
    });
  }

  private async sendCredentialsEmail(params: {
    email?: string | null;
    fullName: string;
    password: string;
    accountType: 'family' | 'authorized';
    requiresPayment?: boolean;
  }): Promise<{ status: ApprovalDeliveryStatus; sentAt: Date | null; error: string | null }> {
    if (!params.email) {
      return { status: ApprovalDeliveryStatus.PENDING, sentAt: null, error: 'No recipient email provided' };
    }
    const loginUrl = `${process.env.FRONTEND_URL || 'https://app.alkarma.com'}/login`;
    const typeLabel = params.accountType === 'family' ? 'Family Member' : 'Authorized User';
    const paymentHint = params.requiresPayment
      ? '<p><strong>Note:</strong> Account access will activate after the authorization fee invoice is paid.</p>'
      : '';

    const subject = `Welcome to SSS Community - ${typeLabel} Account`;
    const html = `
      <h2>Welcome ${params.fullName}!</h2>
      <p>Your ${typeLabel.toLowerCase()} account has been created.</p>
      <p><strong>Login credentials:</strong></p>
      <p>Email: ${params.email}</p>
      <p>Password: ${params.password}</p>
      ${paymentHint}
      <p><a href="${loginUrl}">Login here</a></p>
    `;
    try {
      await this.emailService.sendEmail(subject, params.email, html);
      return { status: ApprovalDeliveryStatus.SENT, sentAt: new Date(), error: null };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Credentials email delivery failed';
      return { status: ApprovalDeliveryStatus.FAILED, sentAt: null, error: message };
    }
  }

  async createFamilyRequest(ownerUserId: string, dto: CreateFamilyRequestDto) {
    await this.assertUnitAccess(ownerUserId, dto.unitId);
    this.validateFamilyRequest(dto);

    return this.prisma.familyAccessRequest.create({
      data: {
        ownerUserId,
        unitId: dto.unitId,
        relationship: dto.relationship,
        fullName: dto.fullName.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone.trim(),
        nationality: dto.nationality ?? NationalityType.EGYPTIAN,
        nationalIdOrPassport: dto.nationalIdOrPassport?.trim() || null,
        personalPhotoFileId: dto.personalPhotoFileId,
        nationalIdFileId: dto.nationalIdFileId ?? null,
        passportFileId: dto.passportFileId ?? null,
        birthCertificateFileId: dto.birthCertificateFileId ?? null,
        marriageCertificateFileId: dto.marriageCertificateFileId ?? null,
        childAgeBracket: dto.childAgeBracket ?? null,
        featurePermissions: (dto.featurePermissions ?? {}) as Prisma.JsonObject,
      },
    });
  }

  async createAuthorizedRequest(ownerUserId: string, dto: CreateAuthorizedRequestDto) {
    await this.assertUnitAccess(ownerUserId, dto.unitId);

    const feeMode = dto.feeMode ?? AuthorizedFeeMode.NO_FEE;
    const feeAmount = feeMode === AuthorizedFeeMode.FEE_REQUIRED ? Number(dto.feeAmount ?? 0) : 0;
    if (feeMode === AuthorizedFeeMode.FEE_REQUIRED && feeAmount <= 0) {
      throw new BadRequestException('Fee amount is required when fee mode is FEE_REQUIRED');
    }

    return this.prisma.authorizedAccessRequest.create({
      data: {
        ownerUserId,
        unitId: dto.unitId,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        nationality: dto.nationality ?? NationalityType.EGYPTIAN,
        nationalIdOrPassport: dto.nationalIdOrPassport?.trim() || null,
        idOrPassportFileId: dto.idOrPassportFileId,
        powerOfAttorneyFileId: dto.powerOfAttorneyFileId,
        personalPhotoFileId: dto.personalPhotoFileId,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        feeMode,
        feeAmount,
        featurePermissions: (dto.delegatePermissions ?? {}) as Prisma.JsonObject,
        qrScopes: Object.entries(dto.delegatePermissions ?? {})
          .filter(([key, value]) => key.toLowerCase().startsWith('qr') && Boolean(value))
          .map(([key]) => key),
      },
    });
  }

  async createHomeStaffAccess(ownerUserId: string, dto: CreateHomeStaffDto) {
    await this.assertUnitAccess(ownerUserId, dto.unitId);

    return this.prisma.homeStaffAccess.create({
      data: {
        ownerUserId,
        unitId: dto.unitId,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        nationality: dto.nationality ?? NationalityType.EGYPTIAN,
        nationalIdOrPassport: dto.nationalIdOrPassport?.trim() || null,
        idOrPassportFileId: dto.idOrPassportFileId,
        personalPhotoFileId: dto.personalPhotoFileId ?? null,
        staffType: dto.staffType,
        employmentFrom: dto.accessFrom ? new Date(dto.accessFrom) : null,
        employmentTo: dto.accessTo ? new Date(dto.accessTo) : null,
        isLiveIn: dto.liveIn ?? false,
        accessValidFrom: new Date(dto.accessFrom),
        accessValidTo: new Date(dto.accessTo),
      },
    });
  }

  listMyRequests(ownerUserId: string, unitId?: string) {
    const unitFilter = unitId ? { unitId } : {};
    return Promise.all([
      this.prisma.familyAccessRequest.findMany({
        where: { ownerUserId, ...unitFilter },
        include: {
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.authorizedAccessRequest.findMany({
        where: { ownerUserId, ...unitFilter },
        include: {
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
          activationInvoice: {
            select: { id: true, invoiceNumber: true, status: true, amount: true, dueDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.homeStaffAccess.findMany({
        where: { ownerUserId, ...unitFilter },
        include: {
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]).then(([family, authorized, homeStaff]) => ({ family, authorized, homeStaff }));
  }

  listAdminRequests(status?: HouseholdRequestStatus | 'ALL') {
    const where =
      status && status !== 'ALL'
        ? { status }
        : undefined;

    return Promise.all([
      this.prisma.familyAccessRequest.findMany({
        where,
        include: {
          owner: {
            select: { id: true, nameEN: true, email: true, phone: true },
          },
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
          activatedUser: {
            select: { id: true, email: true, userStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.authorizedAccessRequest.findMany({
        where,
        include: {
          owner: {
            select: { id: true, nameEN: true, email: true, phone: true },
          },
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
          activatedUser: {
            select: { id: true, email: true, userStatus: true },
          },
          activationInvoice: {
            select: { id: true, invoiceNumber: true, status: true, amount: true, dueDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.homeStaffAccess.findMany({
        where,
        include: {
          owner: {
            select: { id: true, nameEN: true, email: true, phone: true },
          },
          unit: {
            select: { id: true, unitNumber: true, block: true, projectName: true, status: true },
          },
          reviewedBy: {
            select: { id: true, nameEN: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]).then(([family, authorized, homeStaff]) => ({ family, authorized, homeStaff }));
  }

  async reviewFamilyRequest(id: string, reviewerUserId: string, dto: ReviewHouseholdRequestDto) {
    const row = await this.prisma.familyAccessRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Family request not found');
    if (row.status !== HouseholdRequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    if (dto.status === HouseholdRequestStatus.REJECTED) {
      return this.prisma.familyAccessRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason?.trim() || null,
        },
      });
    }

    const provisioned = await this.prisma.$transaction(async (tx) => {
      const current = await tx.familyAccessRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Family request not found');
      if (current.status !== HouseholdRequestStatus.PENDING) {
        throw new BadRequestException('Request is no longer pending');
      }

      const existingByEmail =
        current.email
          ? await tx.user.findFirst({
              where: { email: current.email, id: { not: current.activatedUserId ?? undefined } },
              select: { id: true },
            })
          : null;
      if (existingByEmail) {
        throw new ConflictException('Email already exists for another account');
      }

      const existingByPhone = await tx.user.findFirst({
        where: { phone: current.phone, id: { not: current.activatedUserId ?? undefined } },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictException('Phone already exists for another account');
      }

      if (current.activatedUserId) {
        const activatedUser = await tx.user.findUnique({
          where: { id: current.activatedUserId },
          select: { id: true },
        });
        if (!activatedUser) {
          throw new BadRequestException(
            'Pre-registered family user is missing. Recreate pre-registration first',
          );
        }
      }

      const password = this.generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      const nationalIdFileId =
        current.nationality === NationalityType.FOREIGN
          ? current.passportFileId ?? null
          : current.nationalIdFileId ?? current.birthCertificateFileId ?? null;
      const familyCapabilities = this.buildFamilyCapabilities(
        current.featurePermissions as Record<string, unknown> | null,
      );

      const isPreRegisteredUser =
        current.isPreRegistration === true && Boolean(current.activatedUserId);
      const createdUser = current.activatedUserId
        ? await tx.user.update({
            where: { id: current.activatedUserId },
            data: {
              nameEN: current.fullName,
              email: current.email ?? undefined,
              phone: current.phone,
              passwordHash,
              userStatus: UserStatusEnum.ACTIVE,
              signupSource: 'dashboard',
              profilePhotoId: current.personalPhotoFileId,
              nationalIdFileId: nationalIdFileId ?? undefined,
              requiresOnboarding: isPreRegisteredUser,
              onboardingCompletedAt: isPreRegisteredUser ? null : new Date(),
              onboardingStep: isPreRegisteredUser ? 'OTP' : 'COMPLETE',
            },
          })
        : await tx.user.create({
            data: {
              nameEN: current.fullName,
              email: current.email ?? undefined,
              phone: current.phone,
              passwordHash,
              userStatus: UserStatusEnum.ACTIVE,
              signupSource: 'dashboard',
              profilePhotoId: current.personalPhotoFileId,
              nationalIdFileId: nationalIdFileId ?? undefined,
              requiresOnboarding: false,
              onboardingCompletedAt: new Date(),
              onboardingStep: 'COMPLETE',
            },
          });

      await this.ensureCommunityRole(tx, createdUser.id);

      const resident = await tx.resident.upsert({
        where: { userId: createdUser.id },
        create: {
          userId: createdUser.id,
          nationalId: current.nationalIdOrPassport ?? undefined,
          relationship: this.relationshipToFamilyMemberType(current.relationship),
        },
        update: {
          nationalId: current.nationalIdOrPassport ?? undefined,
          relationship: this.relationshipToFamilyMemberType(current.relationship),
        },
      });

      const ownerResident = await tx.resident.findUnique({
        where: { userId: current.ownerUserId },
        select: { id: true },
      });
      if (!ownerResident) {
        throw new BadRequestException('Owner resident profile is required before approving family requests');
      }

      await tx.familyMember.upsert({
        where: { familyResidentId: resident.id },
        create: {
          primaryResidentId: ownerResident.id,
          familyResidentId: resident.id,
          relationship: this.relationshipToFamilyMemberType(current.relationship),
          status: UserStatusEnum.ACTIVE,
          activatedAt: new Date(),
        },
        update: {
          primaryResidentId: ownerResident.id,
          relationship: this.relationshipToFamilyMemberType(current.relationship),
          status: UserStatusEnum.ACTIVE,
          deactivatedAt: null,
          activatedAt: new Date(),
        },
      });

      await tx.unitAccess.create({
        data: {
          unitId: current.unitId,
          userId: createdUser.id,
          role: 'FAMILY',
          delegateType: 'FAMILY',
          startsAt: new Date(),
          grantedBy: reviewerUserId,
          status: 'ACTIVE',
          source: 'FAMILY_AUTO',
          canViewFinancials: familyCapabilities.canViewFinancials,
          canReceiveBilling: familyCapabilities.canReceiveBilling,
          canBookFacilities: familyCapabilities.canBookFacilities,
          canGenerateQR: familyCapabilities.canGenerateQR,
          canManageWorkers: familyCapabilities.canManageWorkers,
          featurePermissions:
            (current.featurePermissions as Prisma.JsonObject | null) ?? {},
        },
      });

      const typeRows: Array<{
        type: 'NATIONAL_ID' | 'BIRTH_CERTIFICATE' | 'MARRIAGE_CERTIFICATE';
        fileId: string | null | undefined;
      }> = [
        { type: 'NATIONAL_ID', fileId: current.nationalIdFileId ?? current.passportFileId },
        { type: 'BIRTH_CERTIFICATE', fileId: current.birthCertificateFileId },
        { type: 'MARRIAGE_CERTIFICATE', fileId: current.marriageCertificateFileId },
      ];
      for (const rowDoc of typeRows) {
        if (!rowDoc.fileId) continue;
        await tx.residentDocument.upsert({
          where: {
            residentId_type: {
              residentId: resident.id,
              type: rowDoc.type,
            },
          },
          create: {
            residentId: resident.id,
            type: rowDoc.type,
            fileId: rowDoc.fileId,
          },
          update: { fileId: rowDoc.fileId },
        });
      }

      const updated = await tx.familyAccessRequest.update({
        where: { id },
        data: {
          status: HouseholdRequestStatus.APPROVED,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
          activatedUserId: createdUser.id,
        },
      });

      return { updated, password, email: createdUser.email, fullName: createdUser.nameEN ?? current.fullName };
    });

    const delivery = await this.sendCredentialsEmail({
      email: provisioned.email,
      fullName: provisioned.fullName,
      password: provisioned.password,
      accountType: 'family',
    });

    await this.prisma.familyAccessRequest.update({
      where: { id: provisioned.updated.id },
      data: {
        credentialsEmailStatus: delivery.status,
        credentialsEmailSentAt: delivery.sentAt,
        credentialsEmailError: delivery.error,
      },
    });

    return provisioned.updated;
  }

  async reviewAuthorizedRequest(id: string, reviewerUserId: string, dto: ReviewHouseholdRequestDto) {
    const row = await this.prisma.authorizedAccessRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Authorized request not found');
    if (row.status !== HouseholdRequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    if (dto.status === HouseholdRequestStatus.REJECTED) {
      return this.prisma.authorizedAccessRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason?.trim() || null,
        },
      });
    }

    const provisioned = await this.prisma.$transaction(async (tx) => {
      const current = await tx.authorizedAccessRequest.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Authorized request not found');
      if (current.status !== HouseholdRequestStatus.PENDING) {
        throw new BadRequestException('Request is no longer pending');
      }

      const existingByEmail =
        current.email
          ? await tx.user.findFirst({
              where: { email: current.email, id: { not: current.activatedUserId ?? undefined } },
              select: { id: true },
            })
          : null;
      if (existingByEmail) {
        throw new ConflictException('Email already exists for another account');
      }

      const existingByPhone = await tx.user.findFirst({
        where: { phone: current.phone, id: { not: current.activatedUserId ?? undefined } },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictException('Phone already exists for another account');
      }

      const password = this.generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      const capabilities = this.buildAuthorizedCapabilities(
        (current.featurePermissions ?? {}) as Record<string, unknown>,
        current.qrScopes ?? [],
      );
      const requiresFee =
        current.feeMode === AuthorizedFeeMode.FEE_REQUIRED &&
        Number(current.feeAmount ?? 0) > 0;

      const createdUser = await tx.user.create({
        data: {
          nameEN: current.fullName,
          email: current.email ?? undefined,
          phone: current.phone,
          passwordHash,
          userStatus: UserStatusEnum.INVITED,
          signupSource: 'dashboard',
          profilePhotoId: current.personalPhotoFileId,
          nationalIdFileId: current.idOrPassportFileId,
        },
      });
      await this.ensureCommunityRole(tx, createdUser.id);

      await tx.unitAccess.create({
        data: {
          unitId: current.unitId,
          userId: createdUser.id,
          role: 'DELEGATE',
          delegateType: 'FRIEND',
          startsAt: current.authorizationStartsAt ?? current.validFrom ?? new Date(),
          endsAt: current.authorizationEndsAt ?? current.validTo ?? null,
          grantedBy: reviewerUserId,
          status: requiresFee ? 'PENDING' : 'ACTIVE',
          source: 'OWNER_DELEGATION',
          canViewFinancials: capabilities.canViewFinancials,
          canReceiveBilling: capabilities.canReceiveBilling,
          canBookFacilities: capabilities.canBookFacilities,
          canGenerateQR: capabilities.canGenerateQR,
          canManageWorkers: capabilities.canManageWorkers,
          qrScopes: current.qrScopes ?? [],
          featurePermissions: (current.featurePermissions ?? {}) as Prisma.JsonObject,
        },
      });

      let activationInvoiceId = current.activationInvoiceId ?? null;
      if (requiresFee && !activationInvoiceId) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const invoice = await this.invoicesService.generateInvoiceTx(tx, {
          unitId: current.unitId,
          residentId: current.ownerUserId,
          amount: Number(current.feeAmount),
          dueDate,
          type: 'SETUP_FEE',
          status: 'PENDING',
        });
        activationInvoiceId = invoice.id;
      }

      const updated = await tx.authorizedAccessRequest.update({
        where: { id },
        data: {
          status: HouseholdRequestStatus.APPROVED,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: null,
          activatedUserId: createdUser.id,
          activationInvoiceId,
        },
      });

      return {
        updated,
        password,
        email: createdUser.email,
        fullName: createdUser.nameEN ?? current.fullName,
        requiresFee,
      };
    });

    const delivery = await this.sendCredentialsEmail({
      email: provisioned.email,
      fullName: provisioned.fullName,
      password: provisioned.password,
      accountType: 'authorized',
      requiresPayment: provisioned.requiresFee,
    });

    await this.prisma.authorizedAccessRequest.update({
      where: { id: provisioned.updated.id },
      data: {
        credentialsEmailStatus: delivery.status,
        credentialsEmailSentAt: delivery.sentAt,
        credentialsEmailError: delivery.error,
      },
    });

    return provisioned.updated;
  }

  async reviewHomeStaffRequest(id: string, reviewerUserId: string, dto: ReviewHouseholdRequestDto) {
    const row = await this.prisma.homeStaffAccess.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Home staff request not found');
    if (row.status !== HouseholdRequestStatus.PENDING) {
      throw new BadRequestException('Request is no longer pending');
    }

    return this.prisma.homeStaffAccess.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason:
          dto.status === HouseholdRequestStatus.REJECTED
            ? dto.rejectionReason?.trim() || null
            : null,
      },
    });
  }
}
