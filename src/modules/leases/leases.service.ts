import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLeaseDto, UpdateLeaseDto } from './dto/create-lease.dto';
import { AddTenantToLeaseDto } from './dto/add-tenant-to-lease.dto';
import { LeaseStatus, UnitStatus } from '@prisma/client';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // #1. CREATE LEASE
  async create(dto: CreateLeaseDto) {
    // 1. VALIDATION: Check Unit Availability
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { leases: true }, // Include leases to check overlaps
    });

    if (!unit) throw new NotFoundException('Unit not found');

    // Business Rule: Can only lease if Unit is AVAILABLE or OCCUPIED (by owner)
    // If it is ALREADY LEASED, block it.
    if (unit.status === UnitStatus.LEASED) {
      throw new ConflictException('Unit is already LEASED.');
    }

    // 2. VALIDATION: Check for Overlapping Active Leases
    // (Double safety in case status was manually changed)
    const overlappingLease = await this.prisma.lease.findFirst({
      where: {
        unitId: dto.unitId,
        status: LeaseStatus.ACTIVE,
        OR: [
          // Check if new start date falls inside an existing lease
          {
            startDate: { lte: dto.startDate },
            endDate: { gte: dto.startDate },
          },
          // Check if new end date falls inside an existing lease
          {
            startDate: { lte: dto.endDate },
            endDate: { gte: dto.endDate },
          },
          // Check if new lease completely engulfs an existing lease
          {
            startDate: { gte: dto.startDate },
            endDate: { lte: dto.endDate },
          },
        ],
      },
    });

    if (overlappingLease) {
      throw new ConflictException(
        `Unit has an overlapping ACTIVE lease (ID: ${overlappingLease.id}) during this period.`,
      );
    }

    // 2.5 VALIDATION: Check for unique tenant email and national ID
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.tenantEmail },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingNationalId = await this.prisma.resident.findFirst({
      where: { nationalId: dto.tenantNationalId },
    });
    if (existingNationalId) {
      throw new ConflictException('National ID already exists');
    }

    // 3. EXECUTION: Transactional Creation
    return this.prisma.$transaction(async (tx) => {
      // 3.1. Create the User
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(
          Math.floor(Math.random() * chars.length),
        );
      }
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const user = await tx.user.create({
        data: {
          nameEN: dto.tenantName,
          email: dto.tenantEmail,
          phone: dto.tenantPhone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
          nationalIdFileId: dto.nationalIdPhotoId,
        },
      });

      // 3.2. Create the Resident
      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: dto.tenantNationalId,
        },
      });

      // 3.3. Create the Tenant role
      await tx.tenant.create({
        data: { userId: user.id },
      });

      // 3.4. Create the Lease
      const lease = await tx.lease.create({
        data: {
          unitId: dto.unitId,
          ownerId: dto.ownerId,
          tenantId: user.id,
          tenantEmail: dto.tenantEmail,
          tenantNationalId: dto.tenantNationalId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          monthlyRent: dto.monthlyRent,
          securityDeposit: dto.securityDeposit,
          contractFileId: dto.contractFileId,
          status: LeaseStatus.ACTIVE,
        },
      });

      // 3.5. Update the Unit Status to LEASED
      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.LEASED },
      });

      // 3.6. Create resident unit access for tenant
      await tx.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId: dto.unitId,
          isPrimary: true,
        },
      });

      // 3.8. Create unit access (expires with lease)
      await tx.unitAccess.create({
        data: {
          unitId: dto.unitId,
          userId: user.id,
          role: 'TENANT',
          startsAt: new Date(dto.startDate),
          endsAt: new Date(dto.endDate),
          grantedBy: dto.ownerId, // Owner is granting access
          status: 'ACTIVE',
          source: 'LEASE_ASSIGNMENT',
          canViewFinancials: true,
          canReceiveBilling: true,
          canBookFacilities: true,
          canGenerateQR: true,
          canManageWorkers: false,
        },
      });

      // 3.9. Send welcome email
      if (user.email) {
        const subject = `Welcome to Alkarma Community - Your Lease Details`;
        const content = `
          <h2>Welcome ${user.nameEN}!</h2>
          <p>You have been added as a tenant to your leased unit.</p>
          <p><strong>Lease Details:</strong></p>
          <ul>
            <li>Unit: ${unit.unitNumber}</li>
            <li>Start Date: ${dto.startDate.toDateString()}</li>
            <li>End Date: ${dto.endDate.toDateString()}</li>
            <li>Monthly Rent: $${dto.monthlyRent}</li>
          </ul>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Password: ${randomPassword}</p>
          <p>Please change your password after first login.</p>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
        `;
        await this.emailService.sendEmail(subject, user.email, content);
      }

      return lease;
    });
  }

  // #2. LIST ALL LEASES
  async findAll() {
    return this.prisma.lease.findMany({
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        tenant: { select: { nameEN: true, email: true, phone: true } },
        owner: { select: { nameEN: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // #3. GET LEASE INFO
  async findOne(id: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        unit: true,
        tenant: true,
        owner: true,
        contractFile: true,
      },
    });

    if (!lease) throw new NotFoundException(`Lease with ID ${id} not found`);
    return lease;
  }
  // #4. LEASE FOR A SPECIFIC UNIT
  async findByUnit(unitId: string) {
    return this.prisma.lease.findMany({
      where: { unitId },
      include: {
        tenant: { select: { nameEN: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  // #5. UPDATE LEASE
  async update(id: string, dto: UpdateLeaseDto) {
    const existingLease = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Lease
      const updatedLease = await tx.lease.update({
        where: { id },
        data: dto,
      });

      // 2. Handle Termination/Expiration
      if (
        dto.status === LeaseStatus.TERMINATED ||
        dto.status === LeaseStatus.EXPIRED
      ) {
        // Revert Unit Status
        await tx.unit.update({
          where: { id: existingLease.unitId },
          data: { status: UnitStatus.OCCUPIED },
        });

        // NEW: Revoke App Access (Delete ResidentUnit record)
        if (existingLease.tenantId) {
          await tx.residentUnit.deleteMany({
            where: {
              residentId: existingLease.tenantId,
              unitId: existingLease.unitId,
            },
          });
        }

        // TODO: Call AccessService to revoke QR codes
      }

      return updatedLease;
    });
  }

  async remove(id: string) {
    // Retrieve lease details before deletion to get the unitId
    const existingLease = await this.findOne(id);

    // --- PRODUCTION FIX: TRANSACTION REQUIRED ---
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete the Lease record
      const result = await tx.lease.delete({
        where: { id },
      });

      // 2. Revert the Unit Status to OCCUPIED
      await tx.unit.update({
        where: { id: existingLease.unitId },
        data: { status: 'OCCUPIED' },
      });

      return result;
    });
    // TODO: Inject AccessService and call accessService.revokeKeysForUnit(unitId)
  }

  // Add tenant to lease (creates user account and links to lease)
  async addTenantToLease(
    leaseId: string,
    dto: AddTenantToLeaseDto,
    addedBy: string,
  ) {
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
        throw new ForbiddenException(
          'Only admin or lease owner can add tenant',
        );
      }

      // Store tenant snapshot on lease for future reference
      await tx.lease.update({
        where: { id: leaseId },
        data: {
          tenantEmail: dto.tenantEmail,
          tenantNationalId: dto.tenantNationalId,
        },
      });

      // Check for unique email
      const existingEmail = await tx.user.findUnique({
        where: { email: dto.tenantEmail },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }

      // Check national ID uniqueness
      const existingNationalId = await tx.resident.findFirst({
        where: { nationalId: dto.tenantNationalId },
      });
      if (existingNationalId) {
        throw new ConflictException('National ID already exists');
      }

      // Generate secure password
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(
          Math.floor(Math.random() * chars.length),
        );
      }
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      // Create user with complete info from DTO
      const user = await tx.user.create({
        data: {
          nameEN: dto.name,
          email: dto.tenantEmail,
          phone: dto.phone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
          nationalIdFileId: dto.nationalIdPhotoId,
        },
      });

      // Create resident
      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: dto.tenantNationalId,
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
  async terminateLease(
    leaseId: string,
    dto: { reason?: string; terminationDate?: string },
    terminatedBy: string,
  ) {
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
        throw new ForbiddenException(
          'Only admin or lease owner can terminate leases',
        );
      }

      const terminationDate = dto.terminationDate
        ? new Date(dto.terminationDate)
        : new Date();

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

        // Update ResidentUnit to inactive
        await tx.residentUnit.updateMany({
          where: {
            residentId: lease.tenantId,
            unitId: lease.unitId,
          },
          data: {
            // Note: We don't delete ResidentUnit records, just mark as inactive
            // This preserves history while removing active access
          },
        });

        // Deactivate family members if tenant has no other active units
        await this.deactivateTenantFamily(tx, lease.tenantId);

        // Update tenant user status if they have no other active leases or owned units
        await this.updateTenantUserStatus(tx, lease.tenantId);

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
          await this.emailService.sendEmail(
            subject,
            lease.tenant.email,
            content,
          );
        }
      }

      return lease;
    });
  }

  // Helper method to deactivate family members when tenant loses all units
  private async deactivateTenantFamily(tx: any, tenantId: string) {
    // Check if tenant has any other active units
    const activeUnits = await tx.residentUnit.findMany({
      where: {
        residentId: tenantId,
      },
      include: {
        unit: {
          where: {
            leases: {
              some: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    // If no active units, deactivate family members
    if (activeUnits.length === 0) {
      await tx.familyMember.updateMany({
        where: {
          residentId: tenantId,
          status: 'ACTIVE',
        },
        data: {
          status: 'INACTIVE',
          deactivatedAt: new Date(),
        },
      });

      // Also deactivate unit access for family members
      await tx.unitAccess.updateMany({
        where: {
          userId: {
            in: await tx.resident.findMany({
              where: {
                userId: tenantId,
              },
              select: { userId: true },
            }).then(residents => residents.map(r => r.userId)),
          },
          source: 'FAMILY_AUTO',
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }
  }

  // Helper method to update tenant user status
  private async updateTenantUserStatus(tx: any, tenantId: string) {
    // Check if tenant has any active leases
    const activeLeases = await tx.lease.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    // Check if tenant owns any units
    const ownedUnits = await tx.residentUnit.count({
      where: {
        residentId: tenantId,
        isPrimary: true,
      },
    });

    // If no active leases and no owned units, set user to INACTIVE
    if (activeLeases === 0 && ownedUnits === 0) {
      await tx.user.update({
        where: { id: tenantId },
        data: {
          userStatus: 'INACTIVE',
        },
      });

      // Log status change
      await tx.userStatusLog.create({
        data: {
          userId: tenantId,
          oldStatus: 'ACTIVE',
          newStatus: 'INACTIVE',
          source: 'LEASE_TERMINATION',
          note: 'Tenant deactivated due to lease termination and no other active units',
        },
      });
    }
  }
}
