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
  ChildDataDto,
  SpouseDataDto,
  ParentDataDto,
} from './dto/add-family-member.dto';
import {
  UpdateProfileDto,
  UpdateFamilyProfileDto,
} from './dto/update-profile.dto';
import { UnitStatus, UserStatusEnum, UnitAccessRole } from '@prisma/client';

@Injectable()
export class OwnersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createOwnerWithUnit(dto: CreateOwnerWithUnitDto, createdBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if unit exists and is available
      const unit = await tx.unit.findUnique({
        where: { id: dto.unitId },
      });
      if (!unit) {
        throw new BadRequestException('Unit not found');
      }
      if (unit.status !== 'AVAILABLE') {
        throw new BadRequestException('Unit is not available for assignment');
      }

      // Check for unique email and phone
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

      // Check if unit already has a primary resident
      const existingPrimary = await tx.residentUnit.findFirst({
        where: { unitId: dto.unitId, isPrimary: true },
      });
      if (existingPrimary) {
        throw new BadRequestException('Unit already has a primary owner');
      }

      // Check national ID uniqueness
      const existingNationalId = await tx.resident.findFirst({
        where: { nationalId: dto.nationalId },
      });
      if (existingNationalId) {
        throw new ConflictException('National ID already exists');
      }

      // Check national ID photo exists and is valid
      const nationalIdPhoto = await tx.file.findUnique({
        where: { id: dto.nationalIdPhotoId },
      });
      if (!nationalIdPhoto) {
        throw new BadRequestException('National ID photo is required');
      }
      if (nationalIdPhoto.category !== 'NATIONAL_ID') {
        throw new BadRequestException(
          'Invalid file category for national ID photo',
        );
      }

      // Generate secure password automatically
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(
          Math.floor(Math.random() * chars.length),
        );
      }
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      // Create user
      const user = await tx.user.create({
        data: {
          nameEN: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
          nationalIdFileId: dto.nationalIdPhotoId, // Set national ID photo
        },
      });

      // Create resident
      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: dto.nationalId,
        },
      });

      // Create owner
      await tx.owner.create({
        data: {
          userId: user.id,
        },
      });

      // Assign resident to unit as primary
      await tx.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId: dto.unitId,
          isPrimary: true,
        },
      });

      // Create unit access as owner
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

      // Update unit status to NOT_DELIVERED
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: 'NOT_DELIVERED', isDelivered: false },
      });

      // Log status change
      await tx.userStatusLog.create({
        data: {
          userId: user.id,
          oldStatus: 'PENDING',
          newStatus: 'ACTIVE',
          source: 'ADMIN',
          note: 'Owner created by admin for purchased unit',
        },
      });

      // Send welcome email with credentials
      if (user.email) {
        const subject = `Welcome to Alkarma Community - Your Account Details`;
        const content = `
          <h2>Welcome ${user.nameEN}!</h2>
          <p>Your account has been created successfully as an owner in Alkarma Community.</p>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Password: ${randomPassword}</p>
          <p><strong>Important:</strong> Please change your password after first login for security.</p>
          <p><strong>Your Access:</strong></p>
          <ul>
            <li>✅ View financial information</li>
            <li>✅ Receive billing notifications</li>
            <li>✅ Book facilities</li>
            <li>✅ Generate QR codes</li>
            <li>✅ Manage workers</li>
            <li>✅ Add family members and tenants</li>
          </ul>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
          <p>If you did not request this account, please contact our support team immediately.</p>
        `;
        await this.emailService.sendEmail(subject, user.email, content);
      }

      return { user, randomPassword };
    });
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
        throw new BadRequestException('User does not have access to this unit');
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
        await this.emailService.sendEmail(subject, userToRemove.email, content);
      }

      return { message: 'User access revoked successfully' };
    });
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
          nationalIdFileId: dto.nationalIdPhotoId,
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
          where: { nationalId: dto.nationalId, userId: { not: familyUserId } },
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
          nationalIdFileId: dto.nationalIdPhotoId,
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

  // Add family member with new authority-based system
  async addFamilyMember(
    unitId: string,
    dto: AddFamilyMemberDto,
    addedBy: string,
    targetResidentId?: string, // admin-only override
  ) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit || unit.status !== 'DELIVERED') {
        throw new BadRequestException(
          'Unit must be delivered to add family members',
        );
      }

      // Check authority using the resolver
      const authority = await this.prisma.lease.findFirst({
        where: {
          unitId,
          status: 'ACTIVE',
        },
      });

      const currentAuthority = authority ? 'TENANT' : 'OWNER';

      // Check permissions
      const isAdmin = await tx.admin.findUnique({
        where: { userId: addedBy },
      });

      let hasAuthority = false;
      let currentResidentId: string | null = null;

      if (isAdmin) {
        hasAuthority = true;
        // Admin can override or use resolved resident
        if (targetResidentId) {
          currentResidentId = targetResidentId;
        } else {
      // Resolve current resident
      const currentResident = await this.getCurrentResidentForUnit(tx, unitId);
          if (!currentResident) {
            throw new BadRequestException('No current resident found for this unit');
          }
          currentResidentId = currentResident.residentId;
        }
      } else {
        // Normal user must have appropriate access
        const userAccess = await tx.unitAccess.findFirst({
          where: {
            unitId,
            userId: addedBy,
            role: currentAuthority === 'OWNER' ? 'OWNER' : 'TENANT',
            status: 'ACTIVE',
          },
        });

        if (!userAccess) {
          throw new ForbiddenException(
            `You do not have permission to add family members to this unit. Current authority: ${currentAuthority}`,
          );
        }

        hasAuthority = true;
        currentResidentId = userAccess.userId;
      }

      if (!hasAuthority) {
        throw new ForbiddenException(
          'You do not have permission to add family members to this unit',
        );
      }

      // ✅ Correct extraction
      const data = dto.data;

      // Type narrowing based on relationship
      const isChild = dto.relationship === RelationshipType.CHILD;
      const isSpouse = dto.relationship === RelationshipType.SPOUSE;
      const isParent = dto.relationship === RelationshipType.PARENT;

      // Uniqueness checks
      if (data.email) {
        const existingEmail = await tx.user.findUnique({
          where: { email: data.email },
        });
        if (existingEmail)
          throw new ConflictException('Email already registered');
      }

      if (data.phone) {
        const existingPhone = await tx.user.findFirst({
          where: { phone: data.phone },
        });
        if (existingPhone)
          throw new ConflictException('Phone already registered');
      }

      // File validation
      await this.validateFileUploads(
        tx,
        this.getRequiredFileIds(dto.relationship, data),
      );

      // Password
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars[Math.floor(Math.random() * chars.length)];
      }
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      // User
      const user = await tx.user.create({
        data: {
          nameEN: data.name,
          email: data.email ?? undefined,
          phone: data.phone ?? undefined,
          passwordHash,
          userStatus: data.email
            ? UserStatusEnum.ACTIVE
            : UserStatusEnum.INVITED,
          signupSource: 'dashboard',
          profilePhotoId: data.personalPhotoId,
          nationalIdFileId:
            'nationalIdFileId' in data ? data.nationalIdFileId : undefined,
        },
      });

      // Resident
      const residentData: any = {
        userId: user.id,
        relationship: dto.relationship,
      };

      if ('nationalId' in data) {
        residentData.nationalId = data.nationalId ?? undefined;
      }

      if (isChild && 'birthDate' in data && data.birthDate) {
        residentData.birthDate = data.birthDate;
      }

      if (isChild && 'birthCertificateId' in data && data.birthCertificateId) {
        residentData.birthCertificateId = data.birthCertificateId;
      }

      if (isSpouse && 'marriageCertificateId' in data && data.marriageCertificateId) {
        residentData.marriageCertificateId = data.marriageCertificateId;
      }

      const resident = await tx.resident.create({ data: residentData });

      // Create family member record linked to current resident
      // currentResidentId is a userId, but we need the residentId (Resident table ID)
      const currentResident = await tx.resident.findUnique({
        where: { userId: currentResidentId! },
      });
      
      if (!currentResident) {
        throw new BadRequestException('Current resident not found');
      }

      await tx.familyMember.create({
        data: {
          primaryResidentId: currentResident.id,
          familyResidentId: resident.id,
          relationship: dto.relationship,
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });

      // Create UnitAccess for the family member in the current unit
      await tx.unitAccess.create({
        data: {
          unitId: unitId,
          userId: user.id,
          role: 'FAMILY',
          delegateType: 'FAMILY',
          startsAt: new Date(),
          grantedBy: addedBy,
          status: 'ACTIVE',
          source: 'FAMILY_MANUAL',
          canViewFinancials: false,
          canReceiveBilling: false,
          canBookFacilities: true,
          canGenerateQR: false,
          canManageWorkers: false,
        },
      });

      // Auto-propagate to all active units of the resident
      if (currentResidentId) {
        await this.createFamilyUnitAccess(tx, user.id, currentResidentId, addedBy);
      }

      return { user, randomPassword };
    });
  }
  
  // Get required file IDs based on relationship and data
  private getRequiredFileIds(
    relationship: RelationshipType,
    data: any,
  ): string[] {
    const fileIds: string[] = [];

    // Personal photo is always required
    if (data.personalPhotoId) {
      fileIds.push(data.personalPhotoId);
    }

    // National ID file is required for spouse and parent, and for children 16+
    if (data.nationalIdFileId) {
      fileIds.push(data.nationalIdFileId);
    }

    // Relationship-specific files
    if (
      relationship === RelationshipType.SPOUSE &&
      data.marriageCertificateId
    ) {
      fileIds.push(data.marriageCertificateId);
    }

    if (relationship === RelationshipType.CHILD && data.birthCertificateId) {
      fileIds.push(data.birthCertificateId);
    }

    return fileIds;
  }

  // Validate file uploads exist and are correct category
  private async validateFileUploads(tx: any, fileIds: string[]) {
    for (const fileId of fileIds) {
      const file = await tx.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new BadRequestException(`File with ID ${fileId} not found`);
      }

      // Validate file category based on file ID usage
      // This is a simplified check - in production you might want more specific validation
      if (!file.category) {
        throw new BadRequestException(`File ${fileId} has no category`);
      }
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
  }

  // Helper method to get current resident for a unit
  private async getCurrentResidentForUnit(tx: any, unitId: string) {
    // First check for active lease
    const activeLease = await tx.lease.findFirst({
      where: {
        unitId,
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          include: {
            resident: true,
          },
        },
      },
    });

    if (activeLease && activeLease.tenant) {
      return {
        residentId: activeLease.tenant.resident.userId,
        type: 'TENANT',
      };
    }

    // Fall back to owner
    const ownerResidentUnit = await tx.residentUnit.findFirst({
      where: {
        unitId,
        isPrimary: true,
      },
      include: {
        resident: true,
      },
    });

    if (ownerResidentUnit) {
      return {
        residentId: ownerResidentUnit.resident.userId,
        type: 'OWNER',
      };
    }

    return null;
  }

  // Helper method to create family unit access for all active units
  private async createFamilyUnitAccess(tx: any, familyUserId: string, residentId: string, grantedBy: string) {
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
  }
}
