import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import { CreateOwnerWithUnitDto } from './dto/create-owner-with-unit.dto';
import { UpdateProfileDto, UpdateFamilyProfileDto } from './dto/update-profile.dto';
import { CreateLeaseDto } from './dto/create-lease.dto';

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

      // Hash password
      const passwordHash = await bcrypt.hash(dto.password, 12);

      // Create user
      const user = await tx.user.create({
        data: {
          nameEN: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
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
        data: { status: 'NOT_DELIVERED' },
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

      return user;
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
    return this.prisma.owner.delete({
      where: { id },
      include: { user: true },
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
  async updateFamilyProfile(ownerId: string, familyUserId: string, dto: UpdateFamilyProfileDto) {
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
        throw new ForbiddenException('You do not have permission to edit this family member');
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

  // ===== LEASE MANAGEMENT =====

  // Create lease (admin or owner)
  async createLease(dto: CreateLeaseDto, createdBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // Check if unit exists and is available for leasing
      const unit = await tx.unit.findUnique({
        where: { id: dto.unitId },
      });
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      // Check permissions (admin or owner of unit)
      const isAdmin = await tx.admin.findUnique({
        where: { userId: createdBy },
      });

      const isOwner = await tx.unitAccess.findFirst({
        where: {
          unitId: dto.unitId,
          userId: createdBy,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('Only admin or unit owner can create leases');
      }

      // Check if there's already an active lease for this unit
      const existingLease = await tx.lease.findFirst({
        where: {
          unitId: dto.unitId,
          status: 'ACTIVE',
        },
      });

      if (existingLease) {
        throw new ConflictException('Unit already has an active lease');
      }

      // Create lease
      const leaseData: any = {
        unitId: dto.unitId,
        tenantEmail: dto.tenantEmail,
        tenantNationalId: dto.tenantNationalId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        monthlyRent: dto.monthlyRent,
        securityDeposit: dto.securityDeposit,
        contractFileId: dto.contractFileId,
        status: 'ACTIVE',
      };

      if (isOwner) {
        leaseData.ownerId = createdBy; // Only set if owner
      }

      const lease = await tx.lease.create({
        data: leaseData,
      });

      return lease;
    });
  }

  // Add tenant to lease (creates user account and links to lease)
  async addTenantToLease(leaseId: string, nationalIdPhotoId: string, addedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get lease
      const lease = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { unit: true },
      });

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      if (lease.status !== 'ACTIVE') {
        throw new BadRequestException('Lease is not active');
      }

      // Check permissions
      const isAdmin = await tx.admin.findUnique({
        where: { userId: addedBy },
      });

      const isOwner = lease.ownerId && lease.ownerId === addedBy;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('Only admin or lease owner can add tenant');
      }

      // Check if tenant info is complete (from lease data)
      if (!lease.tenantEmail) {
        throw new BadRequestException('Lease tenant email is required');
      }

      // Check for unique email
      const existingEmail = await tx.user.findUnique({
        where: { email: lease.tenantEmail },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }

      // Check national ID uniqueness
      if (lease.tenantNationalId) {
        const existingNationalId = await tx.resident.findFirst({
          where: { nationalId: lease.tenantNationalId },
        });
        if (existingNationalId) {
          throw new ConflictException('National ID already exists');
        }
      }

      // For now, we'll need to get tenant name and phone from somewhere else
      // Since they're not in the lease schema, we'll use default values and require profile update
      const tenantName = 'Tenant'; // This should be provided when creating lease
      const tenantPhone = '0000000000'; // This should be provided when creating lease

      // Generate secure password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      // Create user with basic info (will need profile update for complete details)
      const user = await tx.user.create({
        data: {
          nameEN: tenantName,
          email: lease.tenantEmail,
          phone: tenantPhone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
          nationalIdFileId: nationalIdPhotoId,
        },
      });

      // Create resident
      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: lease.tenantNationalId,
        },
      });

      // Create tenant role
      await tx.tenant.create({
        data: { userId: user.id },
      });

      // Link tenant to lease
      await tx.lease.update({
        where: { id: leaseId },
        data: { tenantId: user.id },
      });

      // Create resident-unit relationship
      await tx.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId: lease.unitId,
          isPrimary: true,
        },
      });

      // Create unit access (expires with lease)
      await tx.unitAccess.create({
        data: {
          unitId: lease.unitId,
          userId: user.id,
          role: 'TENANT',
          startsAt: new Date(lease.startDate),
          endsAt: new Date(lease.endDate),
          grantedBy: addedBy,
          status: 'ACTIVE',
          source: 'LEASE_ASSIGNMENT',
          canViewFinancials: true,
          canReceiveBilling: true,
          canBookFacilities: true,
          canGenerateQR: true,
          canManageWorkers: false,
        },
      });

      // Send welcome email
      if (user.email) {
        const subject = `Welcome to Alkarma Community - Your Lease Details`;
        const content = `
          <h2>Welcome ${user.nameEN}!</h2>
          <p>You have been added as a tenant to your leased unit.</p>
          <p><strong>Lease Details:</strong></p>
          <ul>
            <li>Unit: ${lease.unit.unitNumber}</li>
            <li>Start Date: ${lease.startDate.toDateString()}</li>
            <li>End Date: ${lease.endDate.toDateString()}</li>
            <li>Monthly Rent: $${lease.monthlyRent}</li>
          </ul>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Password: ${randomPassword}</p>
          <p>Please change your password after first login.</p>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
        `;
        await this.emailService.sendEmail(subject, user.email, content);
      }

      return { user, lease, randomPassword };
    });
  }

  // Terminate lease and remove tenant
  async terminateLease(leaseId: string, dto: { reason?: string; terminationDate?: string }, terminatedBy: string) {
    return this.prisma.$transaction(async (tx) => {
      // Get lease with tenant info
      const lease = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { unit: true, tenant: true },
      });

      if (!lease) {
        throw new NotFoundException('Lease not found');
      }

      if (lease.status !== 'ACTIVE') {
        throw new BadRequestException('Lease is not active');
      }

      // Check permissions
      const isAdmin = await tx.admin.findUnique({
        where: { userId: terminatedBy },
      });

      const isOwner = lease.ownerId === terminatedBy;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('Only admin or lease owner can terminate leases');
      }

      const terminationDate = dto.terminationDate ? new Date(dto.terminationDate) : new Date();

      // Update lease status
      await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: 'TERMINATED',
          endDate: terminationDate,
        },
      });

      // Update unit access to expired
      if (lease.tenantId) {
        await tx.unitAccess.updateMany({
          where: {
            unitId: lease.unitId,
            userId: lease.tenantId,
            role: 'TENANT',
          },
          data: {
            status: 'EXPIRED',
            endsAt: terminationDate,
          },
        });

        // Send termination email
        if (lease.tenant && lease.tenant.email) {
          const subject = `Lease Termination Notice - Alkarma Community`;
          const content = `
            <h2>Lease Termination Notice</h2>
            <p>Dear ${lease.tenant.nameEN},</p>
            <p>Your lease for unit ${lease.unit.unitNumber} has been terminated.</p>
            <p><strong>Termination Details:</strong></p>
            <ul>
              <li>Termination Date: ${terminationDate.toDateString()}</li>
              ${dto.reason ? `<li>Reason: ${dto.reason}</li>` : ''}
            </ul>
            <p>Please contact the administration for any questions regarding your security deposit or final settlement.</p>
            <p>If you believe this termination was made in error, please contact us immediately.</p>
          `;
          await this.emailService.sendEmail(subject, lease.tenant.email, content);
        }
      }

      return lease;
    });
  }

  // ===== FAMILY MANAGEMENT =====

  // Add family member (after unit delivery)
  async addFamilyMember(
    unitId: string,
    dto: { name: string; phone: string; email?: string; nationalId?: string; relationship?: string },
    addedBy: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Check unit is delivered
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
      });
      if (!unit || unit.status !== 'DELIVERED') {
        throw new BadRequestException('Unit must be delivered to add family members');
      }

      // Check adder has access to unit (owner or tenant)
      const adderAccess = await tx.unitAccess.findFirst({
        where: {
          unitId,
          userId: addedBy,
          role: { in: ['OWNER', 'TENANT'] },
          status: 'ACTIVE',
        },
      });
      if (!adderAccess) {
        throw new ForbiddenException('You do not have permission to add family members to this unit');
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

      // Check national ID uniqueness
      if (dto.nationalId) {
        const existingNationalId = await tx.resident.findFirst({
          where: { nationalId: dto.nationalId },
        });
        if (existingNationalId) {
          throw new ConflictException('National ID already exists');
        }
      }

      // Generate secure password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
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
        },
      });

      // Create resident
      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: dto.nationalId,
          relationship: dto.relationship,
        },
      });

      // Assign to unit
      await tx.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId,
          isPrimary: false,
        },
      });

      // Create unit access with limited permissions
      await tx.unitAccess.create({
        data: {
          unitId,
          userId: user.id,
          role: 'FAMILY',
          delegateType: 'FAMILY',
          startsAt: new Date(),
          grantedBy: addedBy,
          status: 'ACTIVE',
          source: 'FAMILY_ADDITION',
          canViewFinancials: false,
          canReceiveBilling: false,
          canBookFacilities: true,
          canGenerateQR: false,
          canManageWorkers: false,
        },
      });

      // Send welcome email
      if (user.email) {
        const subject = `Welcome to Alkarma Community - Family Member Access`;
        const content = `
          <h2>Welcome ${user.nameEN}!</h2>
          <p>You have been added as a family member to your family unit.</p>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Password: ${randomPassword}</p>
          <p>Please change your password after first login.</p>
          <p><strong>Access Permissions:</strong></p>
          <ul>
            <li>✅ View announcements</li>
            <li>✅ Book facilities</li>
            <li>❌ View financial information</li>
            <li>❌ Receive billing</li>
            <li>❌ Generate QR codes</li>
            <li>❌ Manage workers</li>
          </ul>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
        `;
        await this.emailService.sendEmail(subject, user.email, content);
      }

      return { user, randomPassword };
    });
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
}
