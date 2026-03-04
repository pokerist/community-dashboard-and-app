import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import { CreateOwnerWithUnitDto } from './dto/create-owner-with-unit.dto';
import { AddOwnerUnitsDto } from './dto/add-owner-units.dto';
import {
  AddFamilyMemberDto,
  RelationshipType,
} from './dto/add-family-member.dto';
import {
  UpdateProfileDto,
  UpdateFamilyProfileDto,
} from './dto/update-profile.dto';
import { FileService } from '../file/file.service';
import {
  Audience,
  Channel,
  NotificationType,
  OwnerInstallmentStatus,
  OwnerPaymentMode,
  $Enums,
  Prisma,
  UnitStatus,
  UserStatusEnum,
  Resident,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OwnersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private fileService: FileService,
    private notificationsService: NotificationsService,
  ) {}
  async createOwnerWithUnit(dto: CreateOwnerWithUnitDto, createdBy: string) {
    const normalizedNameEN = (dto.nameEN ?? dto.name ?? '').trim();
    if (!normalizedNameEN) {
      throw new BadRequestException('Owner English name is required');
    }
    const normalizedNameAR = (dto.nameAR ?? '').trim() || null;
    const normalizedEmail = dto.email?.trim().toLowerCase() || null;
    const normalizedPhone = dto.phone.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('Phone is required');
    }

    const unitAssignmentsInput = Array.isArray(dto.units) && dto.units.length > 0
      ? dto.units
      : dto.unitId
        ? [
            {
              unitId: dto.unitId,
              paymentMode: OwnerPaymentMode.CASH,
            },
          ]
        : [];

    if (unitAssignmentsInput.length === 0) {
      throw new BadRequestException('At least one unit assignment is required');
    }

    const seenUnitIds = new Set<string>();
    for (const assignment of unitAssignmentsInput) {
      const unitId = String(assignment.unitId || '').trim();
      if (!unitId) throw new BadRequestException('Each assignment must include unitId');
      if (seenUnitIds.has(unitId)) {
        throw new BadRequestException(`Duplicate unit assignment detected (${unitId})`);
      }
      seenUnitIds.add(unitId);
    }

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPassword = '';
    for (let i = 0; i < 12; i++) {
      randomPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const result = await this.prisma.$transaction(
      async (tx) => {
        let matchedUser: {
          id: string;
          email: string | null;
          phone: string | null;
          userStatus: UserStatusEnum;
          nationalIdFileId: string | null;
        } | null = null;

        if (normalizedEmail) {
          matchedUser = await tx.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              email: true,
              phone: true,
              userStatus: true,
              nationalIdFileId: true,
            },
          });
        }
        if (!matchedUser) {
          matchedUser = await tx.user.findFirst({
            where: { phone: normalizedPhone },
            select: {
              id: true,
              email: true,
              phone: true,
              userStatus: true,
              nationalIdFileId: true,
            },
          });
        }

        if (matchedUser?.phone && matchedUser.phone !== normalizedPhone) {
          throw new ConflictException(
            'Provided phone does not match the existing account matched by email',
          );
        }
        if (
          matchedUser?.email &&
          normalizedEmail &&
          matchedUser.email.toLowerCase() !== normalizedEmail
        ) {
          throw new ConflictException(
            'Provided email does not match the existing account matched by phone',
          );
        }

        const existingEmailOther =
          normalizedEmail && !matchedUser
            ? await tx.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true },
              })
            : null;
        if (existingEmailOther) {
          throw new ConflictException('Email already registered');
        }

        const existingPhoneOther = !matchedUser
          ? await tx.user.findFirst({
              where: { phone: normalizedPhone },
              select: { id: true },
            })
          : null;
        if (existingPhoneOther) {
          throw new ConflictException('Phone already registered');
        }

        if (dto.nationalId?.trim()) {
          const existingNationalId = await tx.resident.findFirst({
            where: {
              nationalId: dto.nationalId.trim(),
              ...(matchedUser ? { userId: { not: matchedUser.id } } : {}),
            },
            select: { id: true },
          });
          if (existingNationalId) {
            throw new ConflictException('National ID already exists');
          }
        }

        const nationalIdPhoto = await tx.file.findUnique({
          where: { id: dto.nationalIdPhotoId },
          select: { id: true, category: true },
        });
        if (!nationalIdPhoto) {
          throw new BadRequestException('National ID photo is required');
        }
        if (nationalIdPhoto.category !== 'NATIONAL_ID') {
          throw new BadRequestException('Invalid national ID photo');
        }

        const normalizedAssignments: Array<{
          unitId: string;
          paymentMode: OwnerPaymentMode;
          contractFileId: string | null;
          contractSignedAt: Date | null;
          notes: string | null;
          installments: Array<{
            sequence: number;
            dueDate: Date;
            amount: Prisma.Decimal;
            referenceFileId: string | null;
            referencePageIndex: number | null;
          }>;
        }> = [];

        for (const assignment of unitAssignmentsInput) {
          const unitId = String(assignment.unitId).trim();
          const paymentMode =
            assignment.paymentMode ?? OwnerPaymentMode.CASH;

          const unit = await tx.unit.findUnique({
            where: { id: unitId },
            select: { id: true, status: true },
          });
          if (!unit) throw new BadRequestException(`Unit not found (${unitId})`);
          if (
            unit.status !== UnitStatus.AVAILABLE &&
            unit.status !== UnitStatus.NOT_DELIVERED
          ) {
            throw new BadRequestException(
              `Unit ${unitId} is not available for owner assignment`,
            );
          }

          const existingPrimary = await tx.residentUnit.findFirst({
            where: { unitId, isPrimary: true },
            select: { id: true },
          });
          if (existingPrimary) {
            throw new BadRequestException(`Unit ${unitId} already has a primary owner`);
          }

          const contractFileId = assignment.contractFileId?.trim() || null;
          if (contractFileId) {
            const contractFile = await tx.file.findUnique({
              where: { id: contractFileId },
              select: { id: true, category: true },
            });
            if (!contractFile) {
              throw new BadRequestException(
                `Contract file does not exist for unit ${unitId}`,
              );
            }
            if (contractFile.category !== 'CONTRACT') {
              throw new BadRequestException(
                `Contract file must be category CONTRACT for unit ${unitId}`,
              );
            }
          }

          const contractSignedAt = assignment.contractSignedAt
            ? new Date(assignment.contractSignedAt)
            : null;
          if (contractSignedAt && Number.isNaN(contractSignedAt.getTime())) {
            throw new BadRequestException(
              `contractSignedAt is invalid for unit ${unitId}`,
            );
          }

          const rawInstallments = Array.isArray(assignment.installments)
            ? assignment.installments
            : [];
          if (
            paymentMode === OwnerPaymentMode.INSTALLMENT &&
            rawInstallments.length === 0
          ) {
            throw new BadRequestException(
              `Installments are required for installment payment mode (unit ${unitId})`,
            );
          }
          if (
            paymentMode === OwnerPaymentMode.CASH &&
            rawInstallments.length > 0
          ) {
            throw new BadRequestException(
              `Cash mode cannot include installments (unit ${unitId})`,
            );
          }

          const installments: Array<{
            sequence: number;
            dueDate: Date;
            amount: Prisma.Decimal;
            referenceFileId: string | null;
            referencePageIndex: number | null;
          }> = [];
          for (let idx = 0; idx < rawInstallments.length; idx++) {
            const row = rawInstallments[idx];
            const dueDate = new Date(row.dueDate);
            if (Number.isNaN(dueDate.getTime())) {
              throw new BadRequestException(
                `Invalid due date in installment #${idx + 1} for unit ${unitId}`,
              );
            }
            const amountNumber = Number(row.amount);
            if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
              throw new BadRequestException(
                `Invalid amount in installment #${idx + 1} for unit ${unitId}`,
              );
            }
            const referenceFileId = row.referenceFileId?.trim() || null;
            if (referenceFileId) {
              const file = await tx.file.findUnique({
                where: { id: referenceFileId },
                select: { id: true, category: true },
              });
              if (!file) {
                throw new BadRequestException(
                  `Installment reference file does not exist (unit ${unitId}, installment #${idx + 1})`,
                );
              }
              if (!['CONTRACT', 'SERVICE_ATTACHMENT', 'DELIVERY'].includes(file.category)) {
                throw new BadRequestException(
                  `Installment file category is invalid (unit ${unitId}, installment #${idx + 1})`,
                );
              }
            }
            installments.push({
              sequence: idx + 1,
              dueDate,
              amount: new Prisma.Decimal(amountNumber.toFixed(2)),
              referenceFileId,
              referencePageIndex:
                typeof row.referencePageIndex === 'number'
                  ? row.referencePageIndex
                  : null,
            });
          }

          normalizedAssignments.push({
            unitId,
            paymentMode,
            contractFileId,
            contractSignedAt,
            notes: assignment.notes?.trim() || null,
            installments,
          });
        }

        const user = matchedUser
          ? await tx.user.update({
              where: { id: matchedUser.id },
              data: {
                nameEN: normalizedNameEN || undefined,
                nameAR: normalizedNameAR ?? undefined,
                email: matchedUser.email ?? normalizedEmail ?? undefined,
                phone: matchedUser.phone ?? normalizedPhone,
                nationalIdFileId:
                  matchedUser.nationalIdFileId ?? dto.nationalIdPhotoId ?? undefined,
                userStatus:
                  matchedUser.userStatus === UserStatusEnum.DISABLED
                    ? UserStatusEnum.INVITED
                    : matchedUser.userStatus,
              },
            })
          : await tx.user.create({
              data: {
                nameEN: normalizedNameEN,
                nameAR: normalizedNameAR ?? undefined,
                email: normalizedEmail ?? undefined,
                phone: normalizedPhone,
                passwordHash,
                nationalIdFileId: dto.nationalIdPhotoId,
                userStatus: UserStatusEnum.INVITED,
                signupSource: 'dashboard',
              },
            });

        const resident = await tx.resident.upsert({
          where: { userId: user.id },
          update: {
            nationalId: dto.nationalId?.trim() || undefined,
          },
          create: {
            userId: user.id,
            nationalId: dto.nationalId?.trim() || undefined,
          },
        });

        await tx.owner.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });

        const hasPrimaryUnit = await tx.residentUnit.findFirst({
          where: { residentId: resident.id, isPrimary: true },
          select: { id: true },
        });

        for (let index = 0; index < normalizedAssignments.length; index++) {
          const assignment = normalizedAssignments[index];

          await tx.residentUnit.upsert({
            where: {
              residentId_unitId: {
                residentId: resident.id,
                unitId: assignment.unitId,
              },
            },
            update: {},
            create: {
              residentId: resident.id,
              unitId: assignment.unitId,
              isPrimary: !hasPrimaryUnit && index === 0,
            },
          });

          const existingOwnerAccess = await tx.unitAccess.findFirst({
            where: {
              unitId: assignment.unitId,
              userId: user.id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (!existingOwnerAccess) {
            await tx.unitAccess.create({
              data: {
                unitId: assignment.unitId,
                userId: user.id,
                role: 'OWNER',
                startsAt: new Date(),
                grantedBy: createdBy,
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

          await tx.unit.update({
            where: { id: assignment.unitId },
            data: { status: UnitStatus.NOT_DELIVERED, isDelivered: false },
          });

          const ownerUnitContract = await tx.ownerUnitContract.create({
            data: {
              ownerUserId: user.id,
              unitId: assignment.unitId,
              contractFileId: assignment.contractFileId ?? undefined,
              contractSignedAt: assignment.contractSignedAt ?? undefined,
              paymentMode: assignment.paymentMode,
              notes: assignment.notes ?? undefined,
              createdById: createdBy,
            },
          });

          if (assignment.installments.length > 0) {
            await tx.ownerInstallment.createMany({
              data: assignment.installments.map((inst) => ({
                ownerUnitContractId: ownerUnitContract.id,
                sequence: inst.sequence,
                dueDate: inst.dueDate,
                amount: inst.amount,
                referenceFileId: inst.referenceFileId ?? undefined,
                referencePageIndex: inst.referencePageIndex ?? undefined,
                status: OwnerInstallmentStatus.PENDING,
              })),
            });
          }
        }

        if (!matchedUser) {
          await tx.userStatusLog.create({
            data: {
              userId: user.id,
              newStatus: UserStatusEnum.INVITED,
              source: 'ADMIN',
              note: 'Owner created by admin (activation pending)',
            },
          });
        }

        return {
          userId: user.id,
          userEmail: user.email,
          userName: user.nameEN,
          randomPassword: matchedUser ? null : randomPassword,
          reusedExistingUser: Boolean(matchedUser),
          assignedUnits: normalizedAssignments.map((x) => ({
            unitId: x.unitId,
            paymentMode: x.paymentMode,
            installments: x.installments.length,
          })),
        };
      },
      { timeout: 30000 },
    );

    if (result.userEmail && result.userName && result.randomPassword) {
      await this.sendWelcomeEmail(
        result.userEmail,
        result.userName,
        result.randomPassword,
      );
    } else if (result.userEmail && result.userName) {
      try {
        const subject = `Alkarma Community - Unit ownership assignment updated`;
        const content = `
        <h2>Hello ${result.userName},</h2>
        <p>Your account was linked to additional owner unit assignment(s).</p>
        <p>You can sign in with your existing credentials.</p>
      `;
        await this.emailService.sendEmail(subject, result.userEmail, content);
      } catch {
        // best effort
      }
    }

    return { message: 'Owner created successfully', ...result };
  }

  async addUnitsToExistingOwner(
    ownerUserId: string,
    dto: AddOwnerUnitsDto,
    createdBy: string,
  ) {
    if (!Array.isArray(dto.units) || dto.units.length === 0) {
      throw new BadRequestException('At least one unit assignment is required');
    }

    const ownerUser = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, email: true, nameEN: true },
    });
    if (!ownerUser) throw new NotFoundException('Owner user not found');

    await this.prisma.owner.upsert({
      where: { userId: ownerUserId },
      update: {},
      create: { userId: ownerUserId },
    });

    const resident = await this.prisma.resident.upsert({
      where: { userId: ownerUserId },
      update: {},
      create: { userId: ownerUserId },
      select: { id: true },
    });

    const seenUnitIds = new Set<string>();
    const normalizedAssignments: Array<{
      unitId: string;
      paymentMode: OwnerPaymentMode;
      contractFileId: string | null;
      contractSignedAt: Date | null;
      notes: string | null;
      installments: Array<{
        sequence: number;
        dueDate: Date;
        amount: Prisma.Decimal;
        referenceFileId: string | null;
        referencePageIndex: number | null;
      }>;
    }> = [];

    for (const assignment of dto.units) {
      const unitId = String(assignment.unitId || '').trim();
      if (!unitId) throw new BadRequestException('Each assignment must include unitId');
      if (seenUnitIds.has(unitId)) {
        throw new BadRequestException(`Duplicate unit assignment detected (${unitId})`);
      }
      seenUnitIds.add(unitId);

      const paymentMode = assignment.paymentMode ?? OwnerPaymentMode.CASH;
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, status: true },
      });
      if (!unit) throw new BadRequestException(`Unit not found (${unitId})`);
      if (
        unit.status !== UnitStatus.AVAILABLE &&
        unit.status !== UnitStatus.NOT_DELIVERED
      ) {
        throw new BadRequestException(`Unit ${unitId} is not available for owner assignment`);
      }

      const existingContract = await this.prisma.ownerUnitContract.findUnique({
        where: {
          ownerUserId_unitId: {
            ownerUserId,
            unitId,
          },
        },
        select: { id: true },
      });
      if (existingContract) {
        throw new BadRequestException(`Unit ${unitId} is already assigned to this owner`);
      }

      const contractFileId = assignment.contractFileId?.trim() || null;
      if (contractFileId) {
        const file = await this.prisma.file.findUnique({
          where: { id: contractFileId },
          select: { id: true, category: true },
        });
        if (!file || file.category !== 'CONTRACT') {
          throw new BadRequestException(`Invalid contract file for unit ${unitId}`);
        }
      }

      const contractSignedAt = assignment.contractSignedAt
        ? new Date(assignment.contractSignedAt)
        : null;
      if (contractSignedAt && Number.isNaN(contractSignedAt.getTime())) {
        throw new BadRequestException(`Invalid contract date for unit ${unitId}`);
      }

      const rawInstallments = Array.isArray(assignment.installments)
        ? assignment.installments
        : [];
      if (paymentMode === OwnerPaymentMode.INSTALLMENT && rawInstallments.length === 0) {
        throw new BadRequestException(`Installments are required for installment payment mode (unit ${unitId})`);
      }
      if (paymentMode === OwnerPaymentMode.CASH && rawInstallments.length > 0) {
        throw new BadRequestException(`Cash mode cannot include installments (unit ${unitId})`);
      }

      const installments: Array<{
        sequence: number;
        dueDate: Date;
        amount: Prisma.Decimal;
        referenceFileId: string | null;
        referencePageIndex: number | null;
      }> = [];
      for (let idx = 0; idx < rawInstallments.length; idx++) {
        const row = rawInstallments[idx];
        const dueDate = new Date(row.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw new BadRequestException(`Invalid due date in installment #${idx + 1} for unit ${unitId}`);
        }
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new BadRequestException(`Invalid amount in installment #${idx + 1} for unit ${unitId}`);
        }
        installments.push({
          sequence: idx + 1,
          dueDate,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          referenceFileId: row.referenceFileId?.trim() || null,
          referencePageIndex:
            typeof row.referencePageIndex === 'number' ? row.referencePageIndex : null,
        });
      }

      normalizedAssignments.push({
        unitId,
        paymentMode,
        contractFileId,
        contractSignedAt,
        notes: assignment.notes?.trim() || null,
        installments,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const hasPrimary = await tx.residentUnit.findFirst({
        where: { residentId: resident.id, isPrimary: true },
        select: { id: true },
      });

      for (let index = 0; index < normalizedAssignments.length; index++) {
        const assignment = normalizedAssignments[index];

        await tx.residentUnit.upsert({
          where: {
            residentId_unitId: {
              residentId: resident.id,
              unitId: assignment.unitId,
            },
          },
          update: {},
          create: {
            residentId: resident.id,
            unitId: assignment.unitId,
            isPrimary: !hasPrimary && index === 0,
          },
        });

        const existingOwnerAccess = await tx.unitAccess.findFirst({
          where: {
            unitId: assignment.unitId,
            userId: ownerUserId,
            role: 'OWNER',
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (!existingOwnerAccess) {
          await tx.unitAccess.create({
            data: {
              unitId: assignment.unitId,
              userId: ownerUserId,
              role: 'OWNER',
              startsAt: new Date(),
              grantedBy: createdBy,
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

        await tx.unit.update({
          where: { id: assignment.unitId },
          data: { status: UnitStatus.NOT_DELIVERED, isDelivered: false },
        });

        const contract = await tx.ownerUnitContract.create({
          data: {
            ownerUserId,
            unitId: assignment.unitId,
            contractFileId: assignment.contractFileId ?? undefined,
            contractSignedAt: assignment.contractSignedAt ?? undefined,
            paymentMode: assignment.paymentMode,
            notes: assignment.notes ?? undefined,
            createdById: createdBy,
          },
        });

        if (assignment.installments.length > 0) {
          await tx.ownerInstallment.createMany({
            data: assignment.installments.map((row) => ({
              ownerUnitContractId: contract.id,
              sequence: row.sequence,
              dueDate: row.dueDate,
              amount: row.amount,
              referenceFileId: row.referenceFileId ?? undefined,
              referencePageIndex: row.referencePageIndex ?? undefined,
              status: OwnerInstallmentStatus.PENDING,
            })),
          });
        }
      }
    });

    return {
      message: 'Owner units added successfully',
      ownerUserId,
      assignedUnits: normalizedAssignments.map((row) => ({
        unitId: row.unitId,
        paymentMode: row.paymentMode,
        installments: row.installments.length,
      })),
    };
  }

  private validateProfileImage(file: Express.Multer.File) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG and PNG images are allowed');
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 2MB');
    }
  }

  private validateImageOrPdf(file: Express.Multer.File) {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG images and PDF files are allowed',
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }
  }

  async uploadOwnProfilePhoto(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is missing.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    this.validateProfileImage(file);

    const uploaded = await this.fileService.handleUpload(
      file,
      'profile-photos',
      $Enums.FileCategory.PROFILE_PHOTO,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoId: uploaded.id },
    });

    return uploaded;
  }

  async uploadOwnNationalIdPhoto(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is missing.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    this.validateImageOrPdf(file);

    const uploaded = await this.fileService.handleUpload(
      file,
      'identity-docs',
      $Enums.FileCategory.NATIONAL_ID,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { nationalIdFileId: uploaded.id },
    });

    return uploaded;
  }


  // Updated email sender
  async sendWelcomeEmail(email: string, name: string, password: string) {
    if (!email) return; // skip if no email
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'https://app.alkarma.com'}/login`;
      const subject = `Welcome to Alkarma Community - Your Account Details`;
      const content = `
      <h2>Welcome ${name}!</h2>
      <p>Your account has been created successfully as an owner.</p>
      <p><strong>Login credentials:</strong></p>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
      <p><a href="${loginUrl}">Login here</a></p>
      <p>Please sign in and complete your activation steps on first login.</p>
    `;
      await this.emailService.sendEmail(subject, email, content);
    } catch (err: unknown) {
      console.error('EMAIL SENDING FAILED', err);
    }
  }

  // Family member welcome email sender
  async sendFamilyWelcomeEmail(email: string, name: string, password: string) {
    if (!email) return; // skip if no email
    try {
      const subject = `Welcome to Alkarma Community - Your Account Details`;
      const content = `
      <h2>Welcome ${name}!</h2>
      <p>Your account has been created successfully as a family member.</p>
      <p><strong>Login credentials:</strong></p>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
      <p><a href="https://app.alkarma.com/login">Login here</a></p>
      <p>You have been added to a unit by an owner. You can now access community facilities and services.</p>
    `;
      await this.emailService.sendEmail(subject, email, content);
    } catch (err: unknown) {
      console.error('FAMILY EMAIL SENDING FAILED', err);
    }
  }

  private async dispatchInstallmentNotification(params: {
    ownerUserId: string;
    installmentId: string;
    unitId: string;
    amount: Prisma.Decimal;
    dueDate: Date;
    referenceFileId?: string | null;
    kind: 'DUE_SOON' | 'OVERDUE' | 'MARKED_PAID';
    senderId?: string;
  }) {
    const amountText = Number(params.amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const dueDateText = params.dueDate.toISOString().slice(0, 10);

    const title =
      params.kind === 'DUE_SOON'
        ? 'Installment due soon'
        : params.kind === 'OVERDUE'
          ? 'Installment overdue'
          : 'Installment marked as paid';

    const messageEn =
      params.kind === 'DUE_SOON'
        ? `Reminder: Your installment (${amountText} EGP) is due on ${dueDateText}.`
        : params.kind === 'OVERDUE'
          ? `Payment overdue: Installment (${amountText} EGP) was due on ${dueDateText}.`
          : `Payment confirmed: Installment (${amountText} EGP) has been marked as paid.`;

    await this.notificationsService.sendNotification(
      {
        type: NotificationType.PAYMENT_REMINDER,
        title,
        messageEn,
        messageAr:
          params.kind === 'DUE_SOON'
            ? 'تذكير: يوجد قسط مستحق قريبًا.'
            : params.kind === 'OVERDUE'
              ? 'تنبيه: يوجد قسط متأخر مطلوب سداده.'
              : 'تم تأكيد سداد القسط.',
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [params.ownerUserId] },
        payload: {
          route: '/payments',
          entityType: 'OWNER_INSTALLMENT',
          entityId: params.installmentId,
          unitId: params.unitId,
          amount: Number(params.amount),
          dueDate: params.dueDate.toISOString(),
          checkImageFileId: params.referenceFileId ?? null,
          eventKey:
            params.kind === 'DUE_SOON'
              ? 'owner_installment.due_soon'
              : params.kind === 'OVERDUE'
                ? 'owner_installment.overdue'
                : 'owner_installment.paid',
        },
      },
      params.senderId,
    );
  }

  async listOwnerInstallmentsForAdmin(filters?: {
    status?: OwnerInstallmentStatus | 'ALL';
    dueBefore?: string;
    dueAfter?: string;
    ownerUserId?: string;
    unitId?: string;
    onlyOverdue?: boolean;
  }) {
    const where: Prisma.OwnerInstallmentWhereInput = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status as OwnerInstallmentStatus;
    }
    const ownerUnitContractFilter: Prisma.OwnerUnitContractWhereInput = {};
    if (filters?.ownerUserId) {
      ownerUnitContractFilter.ownerUserId = filters.ownerUserId;
    }
    if (filters?.unitId) {
      ownerUnitContractFilter.unitId = filters.unitId;
    }
    if (Object.keys(ownerUnitContractFilter).length > 0) {
      where.ownerUnitContract = { is: ownerUnitContractFilter };
    }
    if (filters?.dueBefore || filters?.dueAfter) {
      const dueDate: Prisma.DateTimeFilter = {};
      if (filters.dueBefore) {
        const date = new Date(filters.dueBefore);
        if (!Number.isNaN(date.getTime())) dueDate.lte = date;
      }
      if (filters.dueAfter) {
        const date = new Date(filters.dueAfter);
        if (!Number.isNaN(date.getTime())) dueDate.gte = date;
      }
      if (Object.keys(dueDate).length > 0) where.dueDate = dueDate;
    }
    if (filters?.onlyOverdue) {
      where.status = OwnerInstallmentStatus.OVERDUE;
    }

    return this.prisma.ownerInstallment.findMany({
      where,
      include: {
        referenceFile: {
          select: { id: true, name: true, mimeType: true, size: true },
        },
        ownerUnitContract: {
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
                block: true,
                projectName: true,
              },
            },
            ownerUser: {
              select: {
                id: true,
                nameEN: true,
                nameAR: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
    });
  }

  async markOwnerInstallmentPaid(
    installmentId: string,
    actorUserId: string,
    paidAt?: string,
    notes?: string,
  ) {
    const installment = await this.prisma.ownerInstallment.findUnique({
      where: { id: installmentId },
      include: {
        ownerUnitContract: {
          select: { ownerUserId: true, unitId: true },
        },
      },
    });
    if (!installment) throw new NotFoundException('Installment not found');
    if (installment.status === OwnerInstallmentStatus.PAID) return installment;

    const paidDate = paidAt ? new Date(paidAt) : new Date();
    if (Number.isNaN(paidDate.getTime())) {
      throw new BadRequestException('Invalid paidAt date');
    }

    const updated = await this.prisma.ownerInstallment.update({
      where: { id: installmentId },
      data: {
        status: OwnerInstallmentStatus.PAID,
        paidAt: paidDate,
        notes: notes?.trim() || installment.notes || undefined,
      },
    });

    await this.dispatchInstallmentNotification({
      ownerUserId: installment.ownerUnitContract.ownerUserId,
      installmentId: updated.id,
      unitId: installment.ownerUnitContract.unitId,
      amount: updated.amount,
      dueDate: updated.dueDate,
      referenceFileId: updated.referenceFileId,
      kind: 'MARKED_PAID',
      senderId: actorUserId,
    });

    return updated;
  }

  async sendOwnerInstallmentReminder(installmentId: string, actorUserId: string) {
    const installment = await this.prisma.ownerInstallment.findUnique({
      where: { id: installmentId },
      include: {
        ownerUnitContract: {
          select: { ownerUserId: true, unitId: true },
        },
      },
    });
    if (!installment) throw new NotFoundException('Installment not found');
    if (installment.status === OwnerInstallmentStatus.PAID) {
      throw new BadRequestException('Cannot remind for a paid installment');
    }

    const now = new Date();
    const isOverdue = installment.dueDate.getTime() < now.getTime();

    await this.dispatchInstallmentNotification({
      ownerUserId: installment.ownerUnitContract.ownerUserId,
      installmentId: installment.id,
      unitId: installment.ownerUnitContract.unitId,
      amount: installment.amount,
      dueDate: installment.dueDate,
      referenceFileId: installment.referenceFileId,
      kind: isOverdue ? 'OVERDUE' : 'DUE_SOON',
      senderId: actorUserId,
    });

    return this.prisma.ownerInstallment.update({
      where: { id: installment.id },
      data: isOverdue
        ? { status: OwnerInstallmentStatus.OVERDUE, overdueNotifiedAt: now }
        : { reminderSentAt: now },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processOwnerInstallmentReminders() {
    const now = new Date();
    const soonDate = new Date(now);
    soonDate.setDate(soonDate.getDate() + 15);

    const dueSoonRows = await this.prisma.ownerInstallment.findMany({
      where: {
        status: OwnerInstallmentStatus.PENDING,
        reminderSentAt: null,
        dueDate: { lte: soonDate, gte: now },
      },
      include: {
        ownerUnitContract: {
          select: { ownerUserId: true, unitId: true },
        },
      },
      take: 300,
    });

    for (const row of dueSoonRows) {
      try {
        await this.dispatchInstallmentNotification({
          ownerUserId: row.ownerUnitContract.ownerUserId,
          installmentId: row.id,
          unitId: row.ownerUnitContract.unitId,
          amount: row.amount,
          dueDate: row.dueDate,
          referenceFileId: row.referenceFileId,
          kind: 'DUE_SOON',
        });
        await this.prisma.ownerInstallment.update({
          where: { id: row.id },
          data: { reminderSentAt: new Date() },
        });
      } catch {
        // keep scheduler resilient
      }
    }

    const overdueRows = await this.prisma.ownerInstallment.findMany({
      where: {
        status: OwnerInstallmentStatus.PENDING,
        dueDate: { lt: now },
      },
      include: {
        ownerUnitContract: {
          select: { ownerUserId: true, unitId: true },
        },
      },
      take: 500,
    });

    for (const row of overdueRows) {
      try {
        await this.dispatchInstallmentNotification({
          ownerUserId: row.ownerUnitContract.ownerUserId,
          installmentId: row.id,
          unitId: row.ownerUnitContract.unitId,
          amount: row.amount,
          dueDate: row.dueDate,
          referenceFileId: row.referenceFileId,
          kind: 'OVERDUE',
        });
        await this.prisma.ownerInstallment.update({
          where: { id: row.id },
          data: {
            status: OwnerInstallmentStatus.OVERDUE,
            overdueNotifiedAt: new Date(),
          },
        });
      } catch {
        // keep scheduler resilient
      }
    }
  }

  async findAll() {
    return this.prisma.owner.findMany({
      include: { user: true },
    });
  }

  async findOne(id: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!owner) {
      throw new BadRequestException('Owner not found');
    }
    return owner;
  }

  async remove(id: string) {
    const owner = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Get the owner's user and unit access
      const user = await tx.user.findUnique({
        where: { id: owner.userId },
      });

      const unitAccess = await tx.unitAccess.findFirst({
        where: {
          userId: owner.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      // Delete the owner record
      await tx.owner.delete({
        where: { id },
      });

      // If owner had unit access, update unit status back to HELD
      if (unitAccess) {
        await tx.unit.update({
          where: { id: unitAccess.unitId },
          data: { status: 'UNRELEASED' as any },
        });
      }

      return owner;
    });
  }

  // Method to remove a user from a unit (for family/tenants)
  async removeUserFromUnit(userId: string, unitId: string, removedBy: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const unit = await tx.unit.findUnique({
          where: { id: unitId },
          select: { id: true },
        });
        if (!unit) throw new NotFoundException('Unit not found');

        const isAdmin = await tx.admin.findUnique({
          where: { userId: removedBy },
          select: { id: true },
        });

        const activeLease = await tx.lease.findFirst({
          where: { unitId, status: 'ACTIVE' },
          select: { tenantId: true },
        });

        // Permission model:
        // - Admin can revoke access for the unit.
        // - Otherwise, only the "current resident" can revoke THEIR FAMILY members from the unit:
        //   - If ACTIVE lease exists => tenant is current resident
        //   - Else => owner is current resident
        if (!isAdmin) {
          if (activeLease?.tenantId) {
            if (activeLease.tenantId !== removedBy) {
              throw new ForbiddenException(
                'Only the active tenant or admin can remove family members from this unit',
              );
            }
          } else {
            const ownerAccess = await tx.unitAccess.findFirst({
              where: {
                unitId,
                userId: removedBy,
                role: 'OWNER',
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            if (!ownerAccess) {
              throw new ForbiddenException(
                'Only the unit owner or admin can remove family members from this unit',
              );
            }
          }
        }

        const accessToRevoke = await tx.unitAccess.findFirst({
          where: {
            unitId,
            userId,
            status: 'ACTIVE',
          },
          select: { id: true, role: true, user: { select: { email: true } } },
        });

        if (!accessToRevoke) {
          throw new BadRequestException(
            'User does not have access to this unit',
          );
        }

        // To keep lease/unit state consistent, tenant removal must go through lease termination.
        if (accessToRevoke.role === 'TENANT') {
          throw new BadRequestException(
            'Cannot remove tenant access from here. Terminate the lease instead.',
          );
        }

        // Ownership changes are handled by the owner/unit onboarding flows, not this endpoint.
        if (accessToRevoke.role === 'OWNER') {
          throw new BadRequestException(
            'Cannot remove owner access from here. Use the ownership management flow instead.',
          );
        }

        if (accessToRevoke.role !== 'FAMILY') {
          throw new BadRequestException(
            'Only FAMILY access can be removed from this endpoint',
          );
        }

        // Non-admins can only revoke access for family members linked to the current resident.
        if (!isAdmin) {
          // Resolve current resident id without pulling nested includes.
          const currentResidentId = activeLease?.tenantId
            ? (
                await tx.resident.findUnique({
                  where: { userId: activeLease.tenantId },
                  select: { id: true },
                })
              )?.id
            : (
                await tx.residentUnit.findFirst({
                  where: { unitId, isPrimary: true },
                  select: { residentId: true },
                })
              )?.residentId;

          if (!currentResidentId) {
            throw new BadRequestException('No current resident found for this unit');
          }

          const targetResident = await tx.resident.findUnique({
            where: { userId },
            select: { id: true },
          });
          if (!targetResident) {
            throw new BadRequestException('Target user is not a resident');
          }

          const isLinkedFamily = await tx.familyMember.findFirst({
            where: {
              primaryResidentId: currentResidentId,
              familyResidentId: targetResident.id,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          if (!isLinkedFamily) {
            throw new ForbiddenException(
              'You can only remove your own family members from this unit',
            );
          }
        }

        await tx.unitAccess.updateMany({
          where: { id: accessToRevoke.id, status: 'ACTIVE' },
          data: { status: 'REVOKED', endsAt: new Date() },
        });

        return {
          message: 'User access revoked successfully',
          email: accessToRevoke.user?.email ?? null,
        };
      },
      { timeout: 20000 },
    );

    // Send email outside the DB transaction (avoid Prisma tx timeouts / rollback on email issues).
    if (result.email) {
      const subject = `Access Revoked - Alkarma Community`;
      const content = `
          <h2>Access Revoked</h2>
          <p>Your access to unit ${unitId} has been revoked.</p>
          <p>If you believe this was done in error, please contact the administration.</p>
        `;
      void this.emailService.sendEmail(subject, result.email, content).catch((e: unknown) => {
        console.error('REMOVE USER EMAIL FAILED', e);
      });
    }

    return { message: result.message };
  }

  // ===== PROFILE MANAGEMENT =====

  // Update own profile
  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.$transaction(async (tx) => {
        // Check national ID uniqueness if provided
        if (dto.nationalId) {
          const existingNationalId = await tx.resident.findFirst({
            where: { nationalId: dto.nationalId, userId: { not: userId } },
          });
          if (existingNationalId) {
            throw new ConflictException('National ID already exists');
          }
        }

        // Check email uniqueness if provided
        if (dto.email) {
          const existingEmail = await tx.user.findFirst({
            where: { email: dto.email, id: { not: userId } },
          });
          if (existingEmail) {
            throw new ConflictException('Email already registered');
          }
        }

        // Check phone uniqueness if provided
        if (dto.phone) {
          const existingPhone = await tx.user.findFirst({
            where: { phone: dto.phone, id: { not: userId } },
          });
          if (existingPhone) {
            throw new ConflictException('Phone already registered');
          }
        }

        // Update user
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            nameEN: dto.nameEN,
            nameAR: dto.nameAR,
            email: dto.email,
            phone: dto.phone,
            profilePhotoId: dto.profilePhotoId,
          },
          include: { resident: true },
        });

        // Update resident if national ID provided
        if (dto.nationalId) {
          await tx.resident.update({
            where: { userId },
            data: {
              nationalId: dto.nationalId,
            },
          });
        }

        return updatedUser;
      });
  }

  // Update family member profile (owner only)
  async updateFamilyProfile(
    ownerId: string,
    familyUserId: string,
    dto: UpdateFamilyProfileDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
        // Check if owner has access to this family member
        const familyAccess = await tx.unitAccess.findFirst({
          where: {
            userId: familyUserId,
            role: 'FAMILY',
            status: 'ACTIVE',
          },
          include: { unit: true },
        });

        if (!familyAccess) {
          throw new NotFoundException('Family member not found');
        }

        // Check if owner has access to the unit
        const ownerAccess = await tx.unitAccess.findFirst({
          where: {
            unitId: familyAccess.unitId,
            userId: ownerId,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        if (!ownerAccess) {
          throw new ForbiddenException(
            'You do not have permission to edit this family member',
          );
        }

        // Check national ID uniqueness if provided
        if (dto.nationalId) {
          const existingNationalId = await tx.resident.findFirst({
            where: {
              nationalId: dto.nationalId,
              userId: { not: familyUserId },
            },
          });
          if (existingNationalId) {
            throw new ConflictException('National ID already exists');
          }
        }

        // Update user
        const updatedUser = await tx.user.update({
          where: { id: familyUserId },
          data: {
            nameEN: dto.nameEN,
            nameAR: dto.nameAR,
            email: dto.email,
            phone: dto.phone,
            profilePhotoId: dto.profilePhotoId,
          },
          include: { resident: true },
        });

        // Update resident
        if (dto.nationalId) {
          await tx.resident.update({
            where: { userId: familyUserId },
            data: {
              nationalId: dto.nationalId,
            },
          });
        }

        return updatedUser;
      });
  }

  // ===== FAMILY MANAGEMENT =====

  async addFamilyMember(
    unitId: string,
    dto: AddFamilyMemberDto,
    addedBy: string,
    targetResidentId?: string, // admin override
  ) {
    // Keep expensive work (bcrypt) out of the DB transaction to avoid Prisma tx timeouts (P2028).
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPassword = '';
    for (let i = 0; i < 12; i++) {
      randomPassword += chars[Math.floor(Math.random() * chars.length)];
    }
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1) Verify unit delivered
        const unit = await tx.unit.findUnique({ where: { id: unitId } });
        // UnitStatus mixes delivery state with occupancy state; once leased/occupied we still treat it as delivered.
        const deliveredStatuses: UnitStatus[] = [
          UnitStatus.DELIVERED,
          UnitStatus.OCCUPIED,
          UnitStatus.LEASED,
        ];
        if (!unit || !deliveredStatuses.includes(unit.status)) {
          throw new BadRequestException(
            'Unit must be delivered to add family members',
          );
        }

        // 2) Resolve current resident (owner or tenant)
        let currentResident: Resident | null = null;
        let currentResidentType: 'OWNER' | 'TENANT' | null = null;

        const isAdmin = await tx.admin.findUnique({ where: { userId: addedBy } });

        if (isAdmin && targetResidentId) {
          currentResident = await tx.resident.findUnique({
            where: { id: targetResidentId },
          });
          if (!currentResident) {
            throw new BadRequestException('Target resident not found');
          }
          currentResidentType = 'OWNER';
        } else {
          const residentWithType = await this.getCurrentResidentForUnit(
            tx,
            unitId,
          );
          if (!residentWithType) {
            throw new BadRequestException('No current resident found for this unit');
          }
          currentResident = residentWithType.resident;
          currentResidentType = residentWithType.type;

          if (!isAdmin) {
            const userAccess = await tx.unitAccess.findFirst({
              where: {
                unitId,
                userId: addedBy,
                role: currentResidentType,
                status: 'ACTIVE',
              },
            });
            if (!userAccess) {
              throw new ForbiddenException(
                'You do not have permission to add family members',
              );
            }
          }
        }

        // 3) Check email & phone uniqueness
        if (dto.email) {
          const existingEmail = await tx.user.findUnique({
            where: { email: dto.email },
          });
          if (existingEmail) {
            throw new ConflictException('Email already registered');
          }
        }
        if (dto.phone) {
          const existingPhone = await tx.user.findFirst({
            where: { phone: dto.phone },
          });
          if (existingPhone) {
            throw new ConflictException('Phone already registered');
          }
        }

        // 4) Determine age (for children)
        let birthDate: Date | null = null;
        if (dto.birthDate) {
          birthDate = new Date(dto.birthDate);
          if (isNaN(birthDate.getTime())) {
            throw new BadRequestException('Invalid birth date');
          }
        }

        const age =
          birthDate && dto.relationship === RelationshipType.CHILD
            ? Math.floor(
                (Date.now() - birthDate.getTime()) /
                  (1000 * 60 * 60 * 24 * 365.25),
              )
            : null;

        // 5) Validate required files
        const fileIds = this.getRequiredFileIds(dto.relationship, dto, age);
        await this.validateFileUploads(tx, fileIds);

        // 6) Create user
        const user = await tx.user.create({
          data: {
            nameEN: dto.name,
            email: dto.email ?? undefined,
            phone: dto.phone ?? undefined,
            passwordHash,
            userStatus: dto.email ? UserStatusEnum.ACTIVE : UserStatusEnum.INVITED,
            signupSource: 'dashboard',
            profilePhotoId: dto.personalPhotoId,
          },
        });

        // 7) Create resident
        const residentData: any = {
          userId: user.id,
          relationship: dto.relationship,
        };
        if (birthDate) residentData.dateOfBirth = birthDate;
        if (dto.nationalId) residentData.nationalId = dto.nationalId;

        const resident = await tx.resident.create({ data: residentData });

        // 8) Create ResidentDocument entries
        if (
          dto.relationship === RelationshipType.CHILD &&
          dto.birthCertificateFileId
        ) {
          await tx.residentDocument.create({
            data: {
              residentId: resident.id,
              type: 'BIRTH_CERTIFICATE',
              fileId: dto.birthCertificateFileId,
            },
          });
        }
        if (dto.relationship === RelationshipType.CHILD && dto.nationalIdFileId) {
          await tx.residentDocument.create({
            data: {
              residentId: resident.id,
              type: 'NATIONAL_ID',
              fileId: dto.nationalIdFileId,
            },
          });
        }
        if (
          dto.relationship === RelationshipType.SPOUSE &&
          dto.marriageCertificateFileId
        ) {
          await tx.residentDocument.create({
            data: {
              residentId: resident.id,
              type: 'MARRIAGE_CERTIFICATE',
              fileId: dto.marriageCertificateFileId,
            },
          });
        }

        // 9) Link family member
        const existing = await tx.familyMember.findFirst({
          where: {
            primaryResidentId: currentResident!.id,
            familyResidentId: resident.id,
          },
        });
        if (existing) {
          throw new ConflictException(
            'Family member already linked to this resident',
          );
        }

        await tx.familyMember.create({
          data: {
            primaryResidentId: currentResident!.id,
            familyResidentId: resident.id,
            relationship: dto.relationship,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });

        return {
          userId: user.id,
          randomPassword,
          residentId: currentResident!.id,
          grantedBy: addedBy,
        };
      },
      { timeout: 20000 },
    );

    // Create family unit access outside transaction to avoid timeout
    try {
      await this.createFamilyUnitAccessOutsideTx(
        result.userId,
        result.residentId,
        result.grantedBy,
      );
    } catch (e: unknown) {
      console.error('CREATE FAMILY UNIT ACCESS FAILED (OUTSIDE TX)', e);
      // Don't throw error here as the main transaction succeeded
    }

    // Send welcome email to family member if they have an email
    if (dto.email) {
      try {
        await this.sendFamilyWelcomeEmail(dto.email, dto.name, result.randomPassword);
      } catch (e: unknown) {
        console.error('FAMILY WELCOME EMAIL FAILED', e);
      }
    }

    return { userId: result.userId, randomPassword: result.randomPassword };
  }


  // ===== FILE VALIDATION =====
  private getRequiredFileIds(
    relationship: RelationshipType,
    data: AddFamilyMemberDto,
    age: number | null,
  ): { fileId: string; type: string }[] {
    const files: { fileId: string; type: string }[] = [];

    // 1️⃣ Personal photo (always required)
    if (!data.personalPhotoId) {
      throw new BadRequestException('Personal photo is required');
    }
    files.push({ fileId: data.personalPhotoId, type: 'PROFILE_PHOTO' });

    // 2️⃣ Child age rules
    if (relationship === RelationshipType.CHILD) {
      if (age !== null && age < 16) {
        if (!data.birthCertificateFileId) {
          throw new BadRequestException(
            'Children under 16 must provide birth certificate',
          );
        }
        files.push({
          fileId: data.birthCertificateFileId,
          type: 'BIRTH_CERTIFICATE',
        });
      }

      if (age !== null && age >= 16) {
        if (!data.nationalId || !data.nationalIdFileId) {
          throw new BadRequestException(
            'Children 16+ must provide national ID and ID file',
          );
        }
        files.push({ fileId: data.nationalIdFileId, type: 'NATIONAL_ID' });
      }
    }

    // 3️⃣ Spouse
    if (relationship === RelationshipType.SPOUSE) {
      if (!data.marriageCertificateFileId) {
        throw new BadRequestException(
          'Marriage certificate is required for spouse',
        );
      }
      files.push({
        fileId: data.marriageCertificateFileId,
        type: 'MARRIAGE_CERTIFICATE',
      });
    }

    return files;
  }

  // ===== VALIDATE FILES =====
  private async validateFileUploads(
    tx: any,
    files: { fileId: string; type: string }[],
  ) {
    const seen = new Set<string>();

    for (const { fileId, type } of files) {
      if (seen.has(fileId)) {
        throw new BadRequestException(`Duplicate file detected: ${fileId}`);
      }
      seen.add(fileId);

      const file = await tx.file.findUnique({ where: { id: fileId } });
      if (!file) throw new BadRequestException(`File not found: ${fileId}`);

      // Make sure category matches expected type
      if (file.category !== type) {
        throw new BadRequestException(
          `File ${fileId} has category ${file.category}, expected ${type}`,
        );
      }
    }
  }

  // Get family members for unit (owner/tenant only)
  async getFamilyMembers(unitId: string, requesterId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new BadRequestException('Unit not found');
    }

    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: requesterId },
      select: { id: true },
    });

    // Check requester has access to unit
    if (!isAdmin) {
      const access = await this.prisma.unitAccess.findFirst({
        where: {
          unitId,
          userId: requesterId,
          role: { in: ['OWNER', 'TENANT'] },
          status: 'ACTIVE',
        },
      });

      if (!access) {
        throw new ForbiddenException('You do not have access to this unit');
      }
    }

    // Resolve the "current resident" for this unit:
    // - If there's an ACTIVE lease, the tenant is the current resident.
    // - Otherwise, fall back to the primary owner resident mapping.
    const activeLease = await this.prisma.lease.findFirst({
      where: { unitId, status: 'ACTIVE' },
      select: {
        tenant: {
          select: {
            resident: { select: { id: true } },
          },
        },
      },
    });

    const currentResidentId =
      activeLease?.tenant?.resident?.id ??
      (
        await this.prisma.residentUnit.findFirst({
          where: { unitId, isPrimary: true },
          select: { residentId: true },
        })
      )?.residentId;

    if (!currentResidentId) return [];

    const familyLinks = await this.prisma.familyMember.findMany({
      where: { primaryResidentId: currentResidentId, status: 'ACTIVE' },
      select: { familyResident: { select: { userId: true } } },
    });
    const familyUserIds = familyLinks
      .map((f) => f.familyResident?.userId)
      .filter(Boolean) as string[];

    if (familyUserIds.length === 0) return [];

    // Get family members (unit access records), filtered to the current resident's family only.
    return this.prisma.unitAccess.findMany({
      where: {
        unitId,
        role: 'FAMILY',
        status: 'ACTIVE',
        userId: { in: familyUserIds },
      },
      include: {
        user: {
          include: {
            resident: true,
          },
        },
      },
    });
  }

  // Helper method to get current resident for a unit
  private async getCurrentResidentForUnit(
    tx: any,
    unitId: string,
  ): Promise<{ resident: Resident; type: 'OWNER' | 'TENANT' } | null> {
    // Try tenant first
    const activeLease = await tx.lease.findFirst({
      where: { unitId, status: 'ACTIVE' },
      include: { tenant: { include: { resident: true } } },
    });

    if (activeLease?.tenant?.resident) {
      return { resident: activeLease.tenant.resident, type: 'TENANT' };
    }

    // Fall back to owner
    const ownerResidentUnit = await tx.residentUnit.findFirst({
      where: { unitId, isPrimary: true },
      include: { resident: true },
    });

    if (ownerResidentUnit?.resident) {
      return { resident: ownerResidentUnit.resident, type: 'OWNER' };
    }

    return null;
  }

  // Helper method to create family unit access outside transaction
  private async createFamilyUnitAccessOutsideTx(
    familyUserId: string,
    residentId: string,
    grantedBy: string,
  ) {
    // Get all active units for the resident
    const activeUnits = await this.prisma.residentUnit.findMany({
      where: {
        residentId,
      },
      select: { unitId: true },
    });

    // Create unit access for family member in all active units
    for (const unit of activeUnits) {
      await this.prisma.unitAccess.create({
        data: {
          unitId: unit.unitId,
          userId: familyUserId,
          role: 'FAMILY',
          delegateType: 'FAMILY',
          startsAt: new Date(),
          grantedBy: grantedBy,
          status: 'ACTIVE',
          source: 'FAMILY_AUTO',
          canViewFinancials: false,
          canReceiveBilling: false,
          canBookFacilities: true,
          canGenerateQR: false,
          canManageWorkers: false,
        },
      });
    }
  }
}
