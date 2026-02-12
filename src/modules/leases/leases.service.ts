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

  private async expireAutoFamilyAccessForUnit(
    tx: any,
    unitId: string,
    endedAt: Date,
  ) {
    await tx.unitAccess.updateMany({
      where: {
        unitId,
        role: 'FAMILY',
        source: 'FAMILY_AUTO',
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
        endsAt: endedAt,
      },
    });
  }

  private async grantFamilyAccessForLease(
    tx: any,
    tenantUserId: string,
    unitId: string,
    startsAt: Date,
    endsAt: Date,
    grantedBy: string,
  ) {
    const tenantResident = await tx.resident.findUnique({
      where: { userId: tenantUserId },
      select: { id: true },
    });
    if (!tenantResident) return;

    const family = await tx.familyMember.findMany({
      where: {
        primaryResidentId: tenantResident.id,
        status: 'ACTIVE',
      },
      select: {
        familyResident: {
          select: { userId: true },
        },
      },
    });

    const familyUserIds = family
      .map((f: any) => f.familyResident?.userId)
      .filter(Boolean);

    if (familyUserIds.length === 0) return;

    const existing = await tx.unitAccess.findMany({
      where: {
        unitId,
        userId: { in: familyUserIds },
        role: 'FAMILY',
        source: 'FAMILY_AUTO',
        status: 'ACTIVE',
      },
      select: { userId: true },
    });

    const existingSet = new Set(existing.map((e: any) => e.userId));
    const missing = familyUserIds.filter((id: string) => !existingSet.has(id));

    if (missing.length === 0) return;

    await tx.unitAccess.createMany({
      data: missing.map((userId: string) => ({
        unitId,
        userId,
        role: 'FAMILY',
        delegateType: 'FAMILY',
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        grantedBy,
        status: 'ACTIVE',
        source: 'FAMILY_AUTO',
        canViewFinancials: false,
        canReceiveBilling: false,
        canBookFacilities: true,
        canGenerateQR: false,
        canManageWorkers: false,
      })),
    });
  }


  private async resolveOwnerUserId(ownerId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });
    if (user) return user.id;

    // Backward-compat: some clients may send Owner.id instead of User.id.
    const owner = await this.prisma.owner.findUnique({
      where: { id: ownerId },
      select: { userId: true },
    });
    if (owner) return owner.userId;

    throw new BadRequestException(
      'Invalid ownerId: must be a valid owner userId (User.id)',
    );
  }

  // #1. CREATE LEASE
  async create(dto: CreateLeaseDto, createdBy: string) {
    if (dto.startDate >= dto.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    if (!dto.contractFileId) {
      throw new BadRequestException('contractFileId is required');
    }

    const ownerUserId = await this.resolveOwnerUserId(dto.ownerId);

    if (!createdBy) {
      throw new BadRequestException('createdBy is required');
    }

    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: createdBy },
      select: { id: true },
    });

    if (!isAdmin && createdBy !== ownerUserId) {
      throw new ForbiddenException(
        'Only admin or the specified owner can create leases',
      );
    }

    const leaseSource = isAdmin ? 'COMPOUND' : 'OWNER';
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

    const ownerAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: dto.unitId,
        userId: ownerUserId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    if (!ownerAccess) {
      throw new ForbiddenException('ownerId is not an active owner of this unit');
    }

    const existingTenantUser = await this.prisma.user.findUnique({
      where: { email: dto.tenantEmail },
      select: { id: true, nationalIdFileId: true },
    });
    const isNewTenant = !existingTenantUser;

    if (
      existingTenantUser?.nationalIdFileId &&
      dto.nationalIdFileId &&
      existingTenantUser.nationalIdFileId !== dto.nationalIdFileId
    ) {
      throw new BadRequestException(
        'Provided nationalIdFileId does not match existing tenant profile',
      );
    }

    const nationalIdFileIdToUse =
      dto.nationalIdFileId ?? existingTenantUser?.nationalIdFileId;
    if (!nationalIdFileIdToUse) {
      throw new BadRequestException(
        'nationalIdFileId is required (upload nationalIdPhoto or provide nationalIdFileId)',
      );
    }

    const [contractFile, nationalIdFile] = await Promise.all([
      this.prisma.file.findUnique({ where: { id: dto.contractFileId } }),
      this.prisma.file.findUnique({ where: { id: nationalIdFileIdToUse } }),
    ]);

    if (!contractFile) {
      throw new BadRequestException('Contract file not found');
    }
    if (contractFile.category !== 'CONTRACT') {
      throw new BadRequestException('Invalid contract file');
    }

    if (!nationalIdFile) {
      throw new BadRequestException('National ID file not found');
    }
    if (nationalIdFile.category !== 'NATIONAL_ID') {
      throw new BadRequestException('Invalid national ID file');
    }

    const existingContractLease = await this.prisma.lease.findFirst({
      where: { contractFileId: dto.contractFileId },
      select: { id: true },
    });

    if (existingContractLease) {
      throw new ConflictException('Contract file is already attached to another lease');
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

    // 2.5 VALIDATION: Support reusing an existing tenant by email (email is unique).
    if (isNewTenant) {
      if (!dto.tenantName) {
        throw new BadRequestException('tenantName is required for new tenants');
      }
      if (!dto.tenantPhone) {
        throw new BadRequestException('tenantPhone is required for new tenants');
      }
      if (!dto.tenantNationalId) {
        throw new BadRequestException(
          'tenantNationalId is required for new tenants',
        );
      }
    }

    if (dto.tenantNationalId) {
      const existingNationalId = await this.prisma.resident.findFirst({
        where: { nationalId: dto.tenantNationalId },
        select: { userId: true },
      });
      if (
        existingNationalId &&
        (!existingTenantUser ||
          existingNationalId.userId !== existingTenantUser.id)
      ) {
        throw new ConflictException('National ID already exists');
      }
    }

    // 3. EXECUTION: Transactional Creation
    // Important: keep expensive work (bcrypt, IO) OUTSIDE the DB transaction to avoid tx timeouts.
    let randomPassword: string | null = null;
    let passwordHash: string | null = null;
    if (isNewTenant) {
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      randomPassword = '';
      for (let i = 0; i < 12; i++) {
        randomPassword += chars.charAt(
          Math.floor(Math.random() * chars.length),
        );
      }
      passwordHash = await bcrypt.hash(randomPassword, 12);
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        let tenantUser =
          existingTenantUser &&
          (await tx.user.findUnique({ where: { id: existingTenantUser.id } }));

        if (!tenantUser) {
          tenantUser = await tx.user.create({
            data: {
              nameEN: dto.tenantName,
              email: dto.tenantEmail,
              phone: dto.tenantPhone,
              passwordHash: passwordHash!,
              userStatus: 'ACTIVE',
              signupSource: 'dashboard',
              nationalIdFileId: nationalIdFileIdToUse,
            },
          });
        } else if (!tenantUser.nationalIdFileId) {
          tenantUser = await tx.user.update({
            where: { id: tenantUser.id },
            data: { nationalIdFileId: nationalIdFileIdToUse },
          });
        }

        // Ensure resident exists and national ID matches
        let tenantResident = await tx.resident.findUnique({
          where: { userId: tenantUser.id },
        });

        if (!tenantResident) {
          tenantResident = await tx.resident.create({
            data: {
              userId: tenantUser.id,
              nationalId: dto.tenantNationalId,
            },
          });
        } else {
          if (
            tenantResident.nationalId &&
            dto.tenantNationalId &&
            tenantResident.nationalId !== dto.tenantNationalId
          ) {
            throw new ConflictException(
              'Tenant national ID does not match existing tenant profile',
            );
          }
          if (!tenantResident.nationalId && dto.tenantNationalId) {
            tenantResident = await tx.resident.update({
              where: { userId: tenantUser.id },
              data: { nationalId: dto.tenantNationalId },
            });
          }
        }

        // Ensure tenant role exists
        const tenantRole = await tx.tenant.findUnique({
          where: { userId: tenantUser.id },
          select: { id: true },
        });
        if (!tenantRole) {
          await tx.tenant.create({ data: { userId: tenantUser.id } });
        }

        const tenantNationalId =
          dto.tenantNationalId ?? tenantResident.nationalId ?? null;

        const lease = await tx.lease.create({
          data: {
            unitId: dto.unitId,
            ownerId: ownerUserId,
            tenantId: tenantUser.id,
            tenantEmail: dto.tenantEmail,
            tenantNationalId,
            startDate: dto.startDate,
            endDate: dto.endDate,
            monthlyRent: dto.monthlyRent,
            securityDeposit: dto.securityDeposit,
            contractFileId: dto.contractFileId,
            status: LeaseStatus.ACTIVE,
            source: leaseSource,
          },
        });

        // When a unit transitions to a tenant lease, any previous auto-family access (typically owner family)
        // must be expired to prevent mixed/incorrect access on the same unit.
        await this.expireAutoFamilyAccessForUnit(tx, dto.unitId, dto.startDate);

        await tx.unit.update({
          where: { id: dto.unitId },
          data: { status: UnitStatus.LEASED },
        });

        await tx.residentUnit.create({
          data: {
            residentId: tenantResident.id,
            unitId: dto.unitId,
            isPrimary: false,
          },
        });

        await tx.unitAccess.create({
          data: {
            unitId: dto.unitId,
            userId: tenantUser.id,
            role: 'TENANT',
            startsAt: new Date(dto.startDate),
            endsAt: new Date(dto.endDate),
            grantedBy: createdBy ?? ownerUserId, // Owner/admin is granting access
            status: 'ACTIVE',
            source: 'LEASE_ASSIGNMENT',
            canViewFinancials: true,
            canReceiveBilling: true,
            canBookFacilities: true,
            canGenerateQR: true,
            canManageWorkers: false,
          },
        });

        // If the tenant already has ACTIVE family members, grant them access to this new unit.
        await this.grantFamilyAccessForLease(
          tx,
          tenantUser.id,
          dto.unitId,
          dto.startDate,
          dto.endDate,
          createdBy ?? ownerUserId,
        );

        return { lease, tenantUser, isNewTenant };
      },
      { timeout: 20000 },
    );

    // Send welcome email only when creating a NEW tenant (avoid re-sending credentials).
    if (result.isNewTenant && result.tenantUser.email) {
      const subject = `Welcome to Alkarma Community - Your Lease Details`;
      const content = `
          <h2>Welcome ${result.tenantUser.nameEN}!</h2>
          <p>You have been added as a tenant to your leased unit.</p>
          <p><strong>Lease Details:</strong></p>
          <ul>
            <li>Unit: ${unit.unitNumber}</li>
            <li>Start Date: ${dto.startDate.toDateString()}</li>
            <li>End Date: ${dto.endDate.toDateString()}</li>
            <li>Monthly Rent: $${dto.monthlyRent}</li>
          </ul>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${result.tenantUser.email}</p>
          <p>Password: ${randomPassword}</p>
          <p>Please change your password after first login.</p>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
        `;
      try {
        await this.emailService.sendEmail(
          subject,
          result.tenantUser.email,
          content,
        );
      } catch (e: unknown) {
        console.error('LEASE WELCOME EMAIL FAILED', e);
      }
    }

    return result.lease;

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
  async update(id: string, dto: UpdateLeaseDto, updatedBy: string) {
    const existingLease = await this.findOne(id);

    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: updatedBy },
      select: { id: true },
    });

    const isOwner = existingLease.ownerId === updatedBy;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Only admin or lease owner can update leases');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const updatedLease = await tx.lease.update({
          where: { id },
          data: dto,
        });

        let cascade:
          | { tenantId: string; unitId: string; endedAt: Date }
          | null = null;

        if (
          dto.status === LeaseStatus.TERMINATED ||
          dto.status === LeaseStatus.EXPIRED
        ) {
          const endedAt = dto.endDate ?? new Date();

          // Revert unit status
          await tx.unit.update({
            where: { id: existingLease.unitId },
            data: { status: UnitStatus.OCCUPIED },
          });

          if (existingLease.tenantId) {
            // Expire tenant access
            await tx.unitAccess.updateMany({
              where: {
                unitId: existingLease.unitId,
                userId: existingLease.tenantId,
                role: 'TENANT',
                status: 'ACTIVE',
              },
              data: {
                status: 'EXPIRED',
                endsAt: endedAt,
              },
            });

            // Remove ResidentUnit mapping for the tenant (ResidentUnit.residentId is Resident.id)
            const tenantResident = await tx.resident.findUnique({
              where: { userId: existingLease.tenantId },
              select: { id: true },
            });

            if (tenantResident) {
              await tx.residentUnit.deleteMany({
                where: {
                  residentId: tenantResident.id,
                  unitId: existingLease.unitId,
                },
              });
            }

            cascade = {
              tenantId: existingLease.tenantId,
              unitId: existingLease.unitId,
              endedAt,
            };
          }
        }

        return { updatedLease, cascade };
      },
      { timeout: 20000 },
    );

    if (result.cascade) {
      try {
        await this.deactivateTenantFamily(
          this.prisma,
          result.cascade.tenantId,
          result.cascade.unitId,
          result.cascade.endedAt,
        );
        await this.updateTenantUserStatus(this.prisma, result.cascade.tenantId);
      } catch (e: unknown) {
        console.error('LEASE UPDATE CASCADE FAILED', e);
      }
    }

    return result.updatedLease;
  }

  async remove(id: string, removedBy: string) {
    const existingLease = await this.findOne(id);

    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: removedBy },
      select: { id: true },
    });

    const isOwner = existingLease.ownerId === removedBy;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Only admin or lease owner can delete leases');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const deleted = await tx.lease.delete({ where: { id } });

        await tx.unit.update({
          where: { id: existingLease.unitId },
          data: { status: UnitStatus.OCCUPIED },
        });

        let cascade:
          | { tenantId: string; unitId: string; endedAt: Date }
          | null = null;

        if (existingLease.tenantId) {
          const endedAt = new Date();

          await tx.unitAccess.updateMany({
            where: {
              unitId: existingLease.unitId,
              userId: existingLease.tenantId,
              role: 'TENANT',
              status: 'ACTIVE',
            },
            data: {
              status: 'EXPIRED',
              endsAt: endedAt,
            },
          });

          const tenantResident = await tx.resident.findUnique({
            where: { userId: existingLease.tenantId },
            select: { id: true },
          });

          if (tenantResident) {
            await tx.residentUnit.deleteMany({
              where: {
                residentId: tenantResident.id,
                unitId: existingLease.unitId,
              },
            });
          }

          cascade = {
            tenantId: existingLease.tenantId,
            unitId: existingLease.unitId,
            endedAt,
          };
        }

        return { deleted, cascade };
      },
      { timeout: 20000 },
    );

    if (result.cascade) {
      try {
        await this.deactivateTenantFamily(
          this.prisma,
          result.cascade.tenantId,
          result.cascade.unitId,
          result.cascade.endedAt,
        );
        await this.updateTenantUserStatus(this.prisma, result.cascade.tenantId);
      } catch (e: unknown) {
        console.error('LEASE DELETE CASCADE FAILED', e);
      }
    }

    return result.deleted;
  }


  // Add tenant to lease (creates user account and links to lease)
  async addTenantToLease(
    leaseId: string,
    dto: AddTenantToLeaseDto,
    addedBy: string,
  ) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPassword = '';
    for (let i = 0; i < 12; i++) {
      randomPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const result = await this.prisma.$transaction(
      async (tx) => {
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

      const isAdmin = await tx.admin.findUnique({ where: { userId: addedBy } });
      const isOwner = lease.ownerId && lease.ownerId === addedBy;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenException('Only admin or lease owner can add tenant');
      }

      await tx.lease.update({
        where: { id: leaseId },
        data: {
          tenantEmail: dto.tenantEmail,
          tenantNationalId: dto.tenantNationalId,
        },
      });

      const existingEmail = await tx.user.findUnique({
        where: { email: dto.tenantEmail },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }

      const existingNationalId = await tx.resident.findFirst({
        where: { nationalId: dto.tenantNationalId },
      });
      if (existingNationalId) {
        throw new ConflictException('National ID already exists');
      }

      const user = await tx.user.create({
        data: {
          nameEN: dto.name,
          email: dto.tenantEmail,
          phone: dto.phone,
          passwordHash,
          userStatus: 'ACTIVE',
          signupSource: 'dashboard',
          nationalIdFileId: dto.nationalIdFileId,
        },
      });

      const resident = await tx.resident.create({
        data: {
          userId: user.id,
          nationalId: dto.tenantNationalId,
        },
      });

      await tx.tenant.create({ data: { userId: user.id } });

      const updatedLease = await tx.lease.update({
        where: { id: leaseId },
        data: { tenantId: user.id },
      });

      await tx.residentUnit.create({
        data: {
          residentId: resident.id,
          unitId: lease.unitId,
          isPrimary: false,
        },
      });

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

      // Unit is now occupied by a tenant: expire any previous auto-family access on this unit
      // (e.g., owner family) to avoid mixing access.
      await this.expireAutoFamilyAccessForUnit(tx, lease.unitId, lease.startDate);

      await this.grantFamilyAccessForLease(
        tx,
        user.id,
        lease.unitId,
        lease.startDate,
        lease.endDate,
        addedBy,
      );

      return { user, lease: updatedLease, randomPassword, unitNumber: lease.unit.unitNumber, monthlyRent: lease.monthlyRent, startDate: lease.startDate, endDate: lease.endDate };
      },
      { timeout: 20000 },
    );

    // Send welcome email outside the DB transaction (don't rollback on email issues)
    if (result.user.email) {
      const subject = `Welcome to Alkarma Community - Your Lease Details`;
      const content = `
          <h2>Welcome ${result.user.nameEN}!</h2>
          <p>You have been added as a tenant to your leased unit.</p>
          <p><strong>Lease Details:</strong></p>
          <ul>
            <li>Unit: ${result.unitNumber}</li>
            <li>Start Date: ${new Date(result.startDate).toDateString()}</li>
            <li>End Date: ${new Date(result.endDate).toDateString()}</li>
            <li>Monthly Rent: $${result.monthlyRent}</li>
          </ul>
          <p><strong>Your login credentials:</strong></p>
          <p>Email: ${result.user.email}</p>
          <p>Password: ${result.randomPassword}</p>
          <p>Please change your password after first login.</p>
          <p><a href="https://app.alkarma.com/login">Login to your account</a></p>
        `;
      try {
        await this.emailService.sendEmail(subject, result.user.email, content);
      } catch (e: unknown) {
        console.error('TENANT WELCOME EMAIL FAILED', e);
      }
    }

    return { user: result.user, lease: result.lease, randomPassword: result.randomPassword };
  }


  // Terminate lease and remove tenant
  async terminateLease(
    leaseId: string,
    dto: { reason?: string; terminationDate?: string },
    terminatedBy: string,
  ) {
    // Keep the DB transaction small to avoid Prisma interactive transaction timeouts (P2028).
    // Any heavier cascade work (family/user deactivation) is executed outside the transaction.
    const result = await this.prisma.$transaction(
      async (tx) => {
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

        const updatedLease = await tx.lease.update({
          where: { id: leaseId },
          data: {
            status: 'TERMINATED',
            endDate: terminationDate,
          },
          include: { unit: true, tenant: true },
        });

        await tx.unit.update({
          where: { id: lease.unitId },
          data: { status: UnitStatus.OCCUPIED },
        });

        if (lease.tenantId) {
          await tx.unitAccess.updateMany({
            where: {
              unitId: lease.unitId,
              userId: lease.tenantId,
              role: 'TENANT',
              status: 'ACTIVE',
            },
            data: {
              status: 'EXPIRED',
              endsAt: terminationDate,
            },
          });

          const tenantResident = await tx.resident.findUnique({
            where: { userId: lease.tenantId },
            select: { id: true },
          });

          if (tenantResident) {
            await tx.residentUnit.deleteMany({
              where: {
                residentId: tenantResident.id,
                unitId: lease.unitId,
              },
            });
          }
        }

        return {
          updatedLease,
          terminationDate,
          tenantId: lease.tenantId,
          unitId: lease.unitId,
        };
      },
      { timeout: 20000 },
    );

    const lease = result.updatedLease;

    if (result.tenantId) {
      try {
        await this.deactivateTenantFamily(
          this.prisma,
          result.tenantId,
          result.unitId,
          result.terminationDate,
        );
        await this.updateTenantUserStatus(this.prisma, result.tenantId);
      } catch (e: unknown) {
        console.error('LEASE TERMINATION CASCADE FAILED', e);
        // Don't fail termination if cascades fail; DB state is already consistent for the lease/unit.
      }
    }

    if (lease.tenant && lease.tenant.email) {
      const subject = `Lease Termination Notice - Alkarma Community`;
      const content = `
            <h2>Lease Termination Notice</h2>
            <p>Dear ${lease.tenant.nameEN},</p>
            <p>Your lease for unit ${lease.unit.unitNumber} has been terminated.</p>
            <p><strong>Termination Details:</strong></p>
            <ul>
              <li>Termination Date: ${result.terminationDate.toDateString()}</li>
              ${dto.reason ? `<li>Reason: ${dto.reason}</li>` : ''}
            </ul>
            <p>Please contact the administration for any questions regarding your security deposit or final settlement.</p>
            <p>If you believe this termination was made in error, please contact us immediately.</p>
          `;
      try {
        await this.emailService.sendEmail(subject, lease.tenant.email, content);
      } catch (e: unknown) {
        console.error('LEASE TERMINATION EMAIL FAILED', e);
      }
    }

    return lease;
  }


  // Helper method to deactivate family members when tenant loses all units
  private async deactivateTenantFamily(
    tx: any,
    tenantUserId: string,
    endedUnitId: string,
    endedAt: Date,
  ) {
    const tenantResident = await tx.resident.findUnique({
      where: { userId: tenantUserId },
      select: { id: true },
    });

    if (!tenantResident) return;

    const family = await tx.familyMember.findMany({
      where: {
        primaryResidentId: tenantResident.id,
        status: 'ACTIVE',
      },
      select: {
        familyResident: {
          select: { userId: true },
        },
      },
    });

    const familyUserIds = family
      .map((f: any) => f.familyResident?.userId)
      .filter(Boolean);

    // Always expire access to the ended unit
    if (familyUserIds.length > 0) {
      await tx.unitAccess.updateMany({
        where: {
          unitId: endedUnitId,
          userId: { in: familyUserIds },
          role: 'FAMILY',
          source: 'FAMILY_AUTO',
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
          endsAt: endedAt,
        },
      });
    }

    // If tenant still has other active leases, family stays active
    const remainingActiveLeases = await tx.lease.count({
      where: {
        tenantId: tenantUserId,
        status: 'ACTIVE',
      },
    });

    if (remainingActiveLeases > 0) return;

    await tx.familyMember.updateMany({
      where: {
        primaryResidentId: tenantResident.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'INACTIVE',
        deactivatedAt: new Date(),
      },
    });

    // Expire any remaining auto family access records
    if (familyUserIds.length > 0) {
      await tx.unitAccess.updateMany({
        where: {
          userId: { in: familyUserIds },
          role: 'FAMILY',
          source: 'FAMILY_AUTO',
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
          endsAt: endedAt,
        },
      });
    }
  }


  // Helper method to update tenant user status
  private async updateTenantUserStatus(tx: any, tenantUserId: string) {
    const [user, activeLeases, activeOwnerUnits] = await Promise.all([
      tx.user.findUnique({
        where: { id: tenantUserId },
        select: { userStatus: true },
      }),
      tx.lease.count({
        where: {
          tenantId: tenantUserId,
          status: 'ACTIVE',
        },
      }),
      tx.unitAccess.count({
        where: {
          userId: tenantUserId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }),
    ]);

    if (!user) return;

    if (activeLeases === 0 && activeOwnerUnits === 0 && user.userStatus !== 'INACTIVE') {
      await tx.user.update({
        where: { id: tenantUserId },
        data: { userStatus: 'INACTIVE' },
      });

      await tx.userStatusLog.create({
        data: {
          userId: tenantUserId,
          newStatus: 'INACTIVE',
          source: 'MANUAL',
          note:
            'Tenant deactivated due to lease termination and no other active leases/owned units',
        },
      });
    }
  }
}
