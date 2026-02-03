import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { AuthorityResolver } from '../../common/utils/authority-resolver.util';
import * as bcrypt from 'bcrypt';
import { CreateOwnerWithUnitDto } from './dto/create-owner-with-unit.dto';
import {
  AddFamilyMemberDto,
  RelationshipType,
} from './dto/add-family-member.dto';
import {
  UpdateProfileDto,
  UpdateFamilyProfileDto,
} from './dto/update-profile.dto';
import {
  UnitStatus,
  UserStatusEnum,
  UnitAccessRole,
  Resident,
} from '@prisma/client';

@Injectable()
export class OwnersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}
  async createOwnerWithUnit(dto: CreateOwnerWithUnitDto, createdBy: string) {
    try {
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
          // 1) Check unit
          const unit = await tx.unit.findUnique({ where: { id: dto.unitId } });
          if (!unit) throw new BadRequestException('Unit not found');
          if (unit.status !== 'AVAILABLE') {
            throw new BadRequestException('Unit not available for assignment');
          }

          // 2) Check email & phone uniqueness
          if (dto.email) {
            const existingEmail = await tx.user.findUnique({
              where: { email: dto.email },
            });
            if (existingEmail) {
              throw new ConflictException('Email already registered');
            }
          }

          const existingPhone = await tx.user.findFirst({
            where: { phone: dto.phone },
          });
          if (existingPhone) {
            throw new ConflictException('Phone already registered');
          }

          // 3) Check primary resident
          const existingPrimary = await tx.residentUnit.findFirst({
            where: { unitId: dto.unitId, isPrimary: true },
          });
          if (existingPrimary) {
            throw new BadRequestException('Unit already has a primary owner');
          }

          // 4) Check national ID
          if (dto.nationalId) {
            const existingNationalId = await tx.resident.findFirst({
              where: { nationalId: dto.nationalId },
            });
            if (existingNationalId) {
              throw new ConflictException('National ID already exists');
            }
          }

          // 5) Check national ID photo
          const nationalIdPhoto = await tx.file.findUnique({
            where: { id: dto.nationalIdPhotoId },
          });
          if (!nationalIdPhoto) {
            throw new BadRequestException('National ID photo is required');
          }
          if (nationalIdPhoto.category !== 'NATIONAL_ID') {
            throw new BadRequestException('Invalid national ID photo');
          }

          // 6) Create user
          const user = await tx.user.create({
            data: {
              nameEN: dto.name,
              email: dto.email ?? undefined,
              phone: dto.phone ?? undefined,
              passwordHash,
              userStatus: dto.email ? UserStatusEnum.ACTIVE : UserStatusEnum.INVITED,
              signupSource: 'dashboard',
            },
          });

          // 7) Create resident
          const resident = await tx.resident.create({
            data: { userId: user.id, nationalId: dto.nationalId ?? undefined },
          });

          // 8) Create owner
          await tx.owner.create({ data: { userId: user.id } });

          // 9) Assign resident to unit as primary
          await tx.residentUnit.create({
            data: {
              residentId: resident.id,
              unitId: dto.unitId,
              isPrimary: true,
            },
          });

          // 10) Create unit access
          await tx.unitAccess.create({
            data: {
              unitId: dto.unitId,
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

          // 11) Update unit status safely
          await tx.unit.update({
            where: { id: dto.unitId },
            data: { status: UnitStatus.NOT_DELIVERED, isDelivered: false },
          });

          // 12) Log user status
          await tx.userStatusLog.create({
            data: {
              userId: user.id,
              newStatus: UserStatusEnum.ACTIVE,
              source: 'ADMIN',
              note: 'Owner created by admin',
            },
          });

          return {
            userId: user.id,
            userEmail: user.email,
            userName: user.nameEN,
            randomPassword,
          };
        },
        { timeout: 20000 },
      );

      // Send welcome email outside transaction
      if (result.userEmail && result.userName) {
        await this.sendWelcomeEmail(
          result.userEmail,
          result.userName,
          result.randomPassword,
        );
      }

      return { message: 'Owner created successfully', ...result };
    } catch (e) {
      console.error('OWNER CREATION FAILED', e);
      throw e;
    }
  }


  // Updated email sender
  async sendWelcomeEmail(email: string, name: string, password: string) {
    if (!email) return; // skip if no email
    try {
      const subject = `Welcome to Alkarma Community - Your Account Details`;
      const content = `
      <h2>Welcome ${name}!</h2>
      <p>Your account has been created successfully as an owner.</p>
      <p><strong>Login credentials:</strong></p>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
      <p><a href="https://app.alkarma.com/login">Login here</a></p>
    `;
      await this.emailService.sendEmail(subject, email, content);
    } catch (err) {
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
    } catch (err) {
      console.error('FAMILY EMAIL SENDING FAILED', err);
    }
  }

  async findAll() {
    try {
      return this.prisma.owner.findMany({
        include: { user: true },
      });
    } catch (e) {
      console.error('FAILED TO FETCH OWNERS', e);
      throw e;
    }
  }

  async findOne(id: string) {
    try {
      const owner = await this.prisma.owner.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!owner) {
        throw new BadRequestException('Owner not found');
      }
      return owner;
    } catch (e) {
      console.error('FAILED TO FIND OWNER', e);
      throw e;
    }
  }

  async remove(id: string) {
    try {
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
    } catch (e) {
      console.error('FAILED TO REMOVE OWNER', e);
      throw e;
    }
  }

  // Method to remove a user from a unit (for family/tenants)
  async removeUserFromUnit(userId: string, unitId: string, removedBy: string) {
    try {
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
            throw new BadRequestException('User does not have access to this unit');
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
              throw new BadRequestException(
                'No current resident found for this unit',
              );
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
        void this.emailService.sendEmail(subject, result.email, content).catch((e) => {
          console.error('REMOVE USER EMAIL FAILED', e);
        });
      }

      return { message: result.message };
    } catch (e) {
      console.error('FAILED TO REMOVE USER FROM UNIT', e);
      throw e;
    }
  }

  // ===== PROFILE MANAGEMENT =====

  // Update own profile
  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    try {
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
    } catch (e) {
      console.error('UPDATE OWN PROFILE FAILED', e);
      throw e;
    }
  }

  // Update family member profile (owner only)
  async updateFamilyProfile(
    ownerId: string,
    familyUserId: string,
    dto: UpdateFamilyProfileDto,
  ) {
    try {
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
    } catch (e) {
      console.error('FAMILY UPDATE PROFILE FAILED', e);
      throw e;
    }
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
    } catch (e) {
      console.error('CREATE FAMILY UNIT ACCESS FAILED (OUTSIDE TX)', e);
      // Don't throw error here as the main transaction succeeded
    }

    // Send welcome email to family member if they have an email
    if (dto.email) {
      try {
        await this.sendFamilyWelcomeEmail(dto.email, dto.name, result.randomPassword);
      } catch (e) {
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
    try {
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
      const familyMembers = await this.prisma.unitAccess.findMany({
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

      return familyMembers;
    } catch (e) {
      console.error('GET FAMILY MEMBERS FAILED', e);
      throw e;
    }
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
    try {
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
    } catch (e) {
      console.error('CREATE FAMILY UNIT ACCESS FAILED (OUTSIDE TX)', e);
      throw e;
    }
  }
}
