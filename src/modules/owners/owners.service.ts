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
      const result = await this.prisma.$transaction(async (tx) => {
        // 1️⃣ Check unit
        const unit = await tx.unit.findUnique({ where: { id: dto.unitId } });
        if (!unit) throw new BadRequestException('Unit not found');
        if (unit.status !== 'AVAILABLE')
          throw new BadRequestException('Unit not available for assignment');

        // 2️⃣ Check email & phone uniqueness
        if (dto.email) {
          const existingEmail = await tx.user.findUnique({
            where: { email: dto.email },
          });
          if (existingEmail)
            throw new ConflictException('Email already registered');
        }
        const existingPhone = await tx.user.findFirst({
          where: { phone: dto.phone },
        });
        if (existingPhone)
          throw new ConflictException('Phone already registered');

        // 3️⃣ Check primary resident
        const existingPrimary = await tx.residentUnit.findFirst({
          where: { unitId: dto.unitId, isPrimary: true },
        });
        if (existingPrimary)
          throw new BadRequestException('Unit already has a primary owner');

        // 4️⃣ Check national ID
        if (dto.nationalId) {
          const existingNationalId = await tx.resident.findFirst({
            where: { nationalId: dto.nationalId },
          });
          if (existingNationalId)
            throw new ConflictException('National ID already exists');
        }

        // 5️⃣ Check national ID photo
        const nationalIdPhoto = await tx.file.findUnique({
          where: { id: dto.nationalIdPhotoId },
        });
        if (!nationalIdPhoto)
          throw new BadRequestException('National ID photo is required');
        if (nationalIdPhoto.category !== 'NATIONAL_ID')
          throw new BadRequestException('Invalid national ID photo');

        // 6️⃣ Generate secure random password
        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomPassword = '';
        for (let i = 0; i < 12; i++)
          randomPassword += chars[Math.floor(Math.random() * chars.length)];
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        // 7️⃣ Create user
        const user = await tx.user.create({
          data: {
            nameEN: dto.name,
            email: dto.email ?? undefined,
            phone: dto.phone ?? undefined,
            passwordHash,
            userStatus: dto.email
              ? UserStatusEnum.ACTIVE
              : UserStatusEnum.INVITED,
            signupSource: 'dashboard',
          },
        });

        // 8️⃣ Create resident
        const resident = await tx.resident.create({
          data: { userId: user.id, nationalId: dto.nationalId ?? undefined },
        });

        // 9️⃣ Create owner
        await tx.owner.create({ data: { userId: user.id } });

        // 🔟 Assign resident to unit as primary
        await tx.residentUnit.create({
          data: {
            residentId: resident.id,
            unitId: dto.unitId,
            isPrimary: true,
          },
        });

        // 1️⃣1️⃣ Create unit access
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

        // 1️⃣2️⃣ Update unit status safely
        await tx.unit.update({
          where: { id: dto.unitId },
          data: { status: UnitStatus.NOT_DELIVERED, isDelivered: false },
        });

        // 1️⃣3️⃣ Log user status
        await tx.userStatusLog.create({
          data: {
            userId: user.id,
            newStatus: UserStatusEnum.ACTIVE,
            source: 'ADMIN',
            note: 'Owner created by admin',
          },
        });

        // ✅ Return necessary info for email (outside transaction)
        return {
          userId: user.id,
          userEmail: user.email,
          userName: user.nameEN,
          randomPassword,
        };
      });

      // 2️⃣ Send welcome email outside transaction
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
      return this.prisma.$transaction(async (tx) => {
        // Check if remover has permission (owner or admin)
        const removerAccess = await tx.unitAccess.findFirst({
          where: {
            unitId,
            userId: removedBy,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        const isAdmin = await tx.admin.findUnique({
          where: { userId: removedBy },
        });

        if (!removerAccess && !isAdmin) {
          throw new ForbiddenException(
            'Only owners or admins can remove users from units',
          );
        }

        // Get the user being removed
        const userToRemove = await tx.user.findUnique({
          where: { id: userId },
          include: { unitAccesses: true },
        });

        if (!userToRemove) {
          throw new NotFoundException('User not found');
        }

        // Check if user has access to this unit
        const userUnitAccess = userToRemove.unitAccesses.find(
          (access) => access.unitId === unitId && access.status === 'ACTIVE',
        );

        if (!userUnitAccess) {
          throw new BadRequestException(
            'User does not have access to this unit',
          );
        }

        // Update unit access status to REVOKED
        await tx.unitAccess.update({
          where: { id: userUnitAccess.id },
          data: { status: 'REVOKED' },
        });

        // Check if this was the last active user in the unit
        const activeUsersCount = await tx.unitAccess.count({
          where: {
            unitId,
            status: 'ACTIVE',
          },
        });

        // If no more active users, set unit status back to UNRELEASED
        if (activeUsersCount === 0) {
          await tx.unit.update({
            where: { id: unitId },
            data: { status: UnitStatus.UNRELEASED },
          });
        }

        // Send removal notification email
        if (userToRemove.email) {
          const subject = `Access Revoked - Alkarma Community`;
          const content = `
          <h2>Access Revoked</h2>
          <p>Your access to unit ${unitId} has been revoked.</p>
          <p>If you believe this was done in error, please contact the administration.</p>
        `;
          await this.emailService.sendEmail(
            subject,
            userToRemove.email,
            content,
          );
        }

        return { message: 'User access revoked successfully' };
      });
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

  // Add family member with new authority-based system
  async addFamilyMember(
    unitId: string,
    dto: AddFamilyMemberDto,
    addedBy: string,
    targetResidentId?: string, // admin override
  ) {
    try {
      return this.prisma.$transaction(async (tx) => {
        // 1️⃣ Check unit delivered
        const unit = await tx.unit.findUnique({ where: { id: unitId } });
        if (!unit || unit.status !== UnitStatus.DELIVERED) {
          throw new BadRequestException(
            'Unit must be delivered to add family members',
          );
        }

        // 2️⃣ Resolve current resident (owner or tenant)
        let currentResidentObject: Resident | null = null;
        let currentResidentType: 'OWNER' | 'TENANT' | null = null;

        const isAdmin = await tx.admin.findUnique({
          where: { userId: addedBy },
        });

        if (isAdmin && targetResidentId) {
          const resident = await tx.resident.findUnique({
            where: { id: targetResidentId },
          });
          if (!resident)
            throw new BadRequestException('Target resident not found');

          currentResidentObject = resident;
          currentResidentType = 'OWNER'; // admin override counts as OWNER
        } else {
          const residentWithType = await this.getCurrentResidentForUnit(
            tx,
            unitId,
          );
          if (!residentWithType)
            throw new BadRequestException(
              'No current resident found for this unit',
            );

          currentResidentObject = residentWithType.resident;
          currentResidentType = residentWithType.type;

          // Check addedBy has permission
          const accessRole =
            currentResidentType === 'OWNER' ? 'OWNER' : 'TENANT';
          const userAccess = await tx.unitAccess.findFirst({
            where: {
              unitId,
              userId: addedBy,
              role: accessRole,
              status: 'ACTIVE',
            },
          });
          if (!userAccess)
            throw new ForbiddenException(
              'You do not have permission to add family members',
            );
        }

        // 3️⃣ Check uniqueness
        if (dto.email) {
          const existingEmail = await tx.user.findUnique({
            where: { email: dto.email },
          });
          if (existingEmail)
            throw new ConflictException('Email already registered');
        }
        if (dto.phone) {
          const existingPhone = await tx.user.findFirst({
            where: { phone: dto.phone },
          });
          if (existingPhone)
            throw new ConflictException('Phone already registered');
        }

        // 4️⃣ Validate required files
        const fileIds = this.getRequiredFileIds(dto.relationship, dto);
        await this.validateFileUploads(tx, fileIds);

        // 5️⃣ Handle birthDate conversion
        let birthDate: Date | null = null;
        if (dto.relationship === RelationshipType.CHILD) {
          if (!dto.birthDate) {
            throw new BadRequestException(
              'Birth date is required for children',
            );
          }
          birthDate = new Date(dto.birthDate);
          const age =
            (new Date().getTime() - birthDate.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25);
          if (age > 16) throw new BadRequestException('Child must be under 16');
        }

        // 6️⃣ Generate password
        const chars =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomPassword = '';
        for (let i = 0; i < 12; i++)
          randomPassword += chars[Math.floor(Math.random() * chars.length)];
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        // 7️⃣ Create user
        const user = await tx.user.create({
          data: {
            nameEN: dto.name,
            email: dto.email ?? undefined,
            phone: dto.phone ?? undefined,
            passwordHash,
            userStatus: dto.email
              ? UserStatusEnum.ACTIVE
              : UserStatusEnum.INVITED,
            signupSource: 'dashboard',
            profilePhotoId: dto.personalPhotoId,
          },
        });

        // 8️⃣ Create resident
        const residentData: any = {
          userId: user.id,
          relationship: dto.relationship,
        };
        if (dto.nationalId) residentData.nationalId = dto.nationalId;
        if (birthDate) residentData.dateOfBirth = birthDate;
        const resident = await tx.resident.create({ data: residentData });

        // 9️⃣ Create ResidentDocument entries
        if (
          dto.relationship === RelationshipType.SPOUSE &&
          dto.marriageCertificateId
        ) {
          await tx.residentDocument.create({
            data: {
              residentId: resident.id,
              type: 'MARRIAGE_CERTIFICATE',
              fileId: dto.marriageCertificateId,
            },
          });
        }
        if (
          dto.relationship === RelationshipType.CHILD &&
          dto.birthCertificateId
        ) {
          await tx.residentDocument.create({
            data: {
              residentId: resident.id,
              type: 'BIRTH_CERTIFICATE',
              fileId: dto.birthCertificateId,
            },
          });
        }

        // 🔟 Link family member
        if (!currentResidentObject) {
          throw new BadRequestException(
            'No current resident found for this unit',
          );
        }

        const existing = await tx.familyMember.findFirst({
          where: {
            primaryResidentId: currentResidentObject.id,
            familyResidentId: resident.id,
          },
        });
        if (existing)
          throw new ConflictException(
            'Family member already linked to this resident',
          );

        await tx.familyMember.create({
          data: {
            primaryResidentId: currentResidentObject.id,
            familyResidentId: resident.id,
            relationship: dto.relationship,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });

        // 1️⃣1️⃣ Create unit access
        await this.createFamilyUnitAccess(
          tx,
          user.id,
          currentResidentObject.id,
          addedBy,
        );

        return { userId: user.id, randomPassword };
      });
    } catch (e) {
      console.error('ADD FAMILY FAILED', e);
      throw e;
    }
  }

  // ===== FILE VALIDATION =====

  // Get required file IDs based on relationship and data
  private getRequiredFileIds(
    relationship: RelationshipType,
    data: any,
  ): {
    fileId: string;
    type:
      | 'PERSONAL_PHOTO'
      | 'NATIONAL_ID'
      | 'MARRIAGE_CERTIFICATE'
      | 'BIRTH_CERTIFICATE';
  }[] {
    const files: {
      fileId: string;
      type:
        | 'PERSONAL_PHOTO'
        | 'NATIONAL_ID'
        | 'MARRIAGE_CERTIFICATE'
        | 'BIRTH_CERTIFICATE';
    }[] = [];

    // 1️⃣ Personal photo - always required
    if (!data.personalPhotoId) {
      throw new BadRequestException('Personal photo is required');
    }
    files.push({ fileId: data.personalPhotoId, type: 'PERSONAL_PHOTO' });

    // 2️⃣ National ID
    if (
      (relationship === RelationshipType.SPOUSE ||
        relationship === RelationshipType.PARENT) &&
      !data.nationalIdFileId
    ) {
      throw new BadRequestException(
        'National ID file is required for spouse/parent',
      );
    }
    if (data.nationalIdFileId) {
      files.push({ fileId: data.nationalIdFileId, type: 'NATIONAL_ID' });
    }

    // 3️⃣ Spouse - marriage certificate
    if (relationship === RelationshipType.SPOUSE) {
      if (!data.marriageCertificateId) {
        throw new BadRequestException(
          'Marriage certificate is required for spouse',
        );
      }
      files.push({
        fileId: data.marriageCertificateId,
        type: 'MARRIAGE_CERTIFICATE',
      });
    }

    // 4️⃣ Child - birth certificate + age check
    if (relationship === RelationshipType.CHILD) {
      if (!data.birthCertificateId) {
        throw new BadRequestException(
          'Birth certificate is required for child',
        );
      }
      if (!data.birthDate) {
        throw new BadRequestException('Birth date is required for child');
      }
      const age = this.calculateAge(new Date(data.birthDate));
      if (age > 16) {
        throw new BadRequestException('Child must be under 16');
      }
      files.push({
        fileId: data.birthCertificateId,
        type: 'BIRTH_CERTIFICATE',
      });
    }

    return files;
  }

  // Validate file uploads exist, category matches expected, and no duplicates
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
      if (!file) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Ensure category matches expected type
      if (file.category !== type) {
        throw new BadRequestException(
          `File ${fileId} has category ${file.category}, expected ${type}`,
        );
      }

      // Optional: size/type checks could go here if needed
    }
  }

  // Calculate age from birth date
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      return age - 1;
    }

    return age;
  }

  // Get family members for unit (owner/tenant only)
  async getFamilyMembers(unitId: string, requesterId: string) {
    try {
      // Check requester has access to unit
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

      // Get family members
      const familyMembers = await this.prisma.unitAccess.findMany({
        where: {
          unitId,
          role: 'FAMILY',
          status: 'ACTIVE',
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

  // Helper method to create family unit access for all active units
  private async createFamilyUnitAccess(
    tx: any,
    familyUserId: string,
    residentId: string,
    grantedBy: string,
  ) {
    try {
      // Get all active units for the resident
      const activeUnits = await tx.residentUnit.findMany({
        where: {
          residentId,
        },
        select: { unitId: true },
      });

      // Create unit access for family member in all active units
      for (const unit of activeUnits) {
        await tx.unitAccess.create({
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
      console.error('CREATE FAMILY UNIT ACCESS FAILED', e);
      throw e;
    }
  }
}
