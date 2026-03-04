import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, UserStatusEnum, UnitStatus } from '@prisma/client';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { UpdateResidentProfileAdminDto } from './dto/update-resident-profile-admin.dto';
import { AssignResidentUnitDto } from './dto/assign-resident-unit.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import * as bcrypt from 'bcrypt';

// Type definitions for Prisma includes
type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    roles: { include: { role: true } };
    resident: { include: { residentUnits: { include: { unit: true } } } };
    owner: true;
    tenant: true;
    admin: true;
    leasesAsOwner: true;
    leasesAsTenant: true;
    invoices: true;
  };
}>;

// Optimized include for basic user info (can be used for list views)
const userBasicInclude = {
  roles: { include: { role: true } },
  resident: true,
  owner: true,
  tenant: true,
  admin: true,
};

type ResidentWithUser = Prisma.ResidentGetPayload<{
  include: { user: true };
}>;

type OwnerWithUser = Prisma.OwnerGetPayload<{
  include: { user: true };
}>;

type TenantWithUser = Prisma.TenantGetPayload<{
  include: { user: true };
}>;

type AdminWithUser = Prisma.AdminGetPayload<{
  include: { user: true };
}>;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private permissionCacheService: PermissionCacheService,
  ) {}

  private enforceDirectCreationPolicy(options?: { permissions?: string[] }) {
    if (!options?.permissions?.includes('user.create.direct')) {
      throw new ForbiddenException(
        'Direct creation requires user.create.direct permission',
      );
    }
  }

  // ===== USER MANAGEMENT =====

  /**
   * Create a new user (base user without profile type)
   */
  async createUser(
    data: CreateUserDto,
    options?: { actorUserId?: string; permissions?: string[] },
  ): Promise<UserWithRelations> {
    if (data.signupSource === 'dashboard') {
      this.enforceDirectCreationPolicy(options);
    }

    const { password, roles: roleIds, ...rest } = data;

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    // Use transaction to ensure atomicity
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          ...rest,
          passwordHash,
          userStatus: UserStatusEnum.ACTIVE,
          signupSource: data.signupSource ?? 'dashboard',
        },
      });

      if (roleIds?.length) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: createdUser.id,
            roleId,
          })),
        });
      }

      return createdUser;
    });

    return this.getUserWithRelations(user.id);
  }

  /**
   * Get all users with optional filtering
   */
  async findAllUsers(
    userType?: 'resident' | 'owner' | 'tenant' | 'admin',
    skip: number = 0,
    take: number = 20,
  ): Promise<UserWithRelations[]> {
    // Return all users regardless of status so deactivated users remain visible in admin lists.
    const where: Prisma.UserWhereInput = {};

    // Filter by user type if provided
    if (userType === 'resident') {
      where.resident = { isNot: null };
    } else if (userType === 'owner') {
      where.owner = { isNot: null };
    } else if (userType === 'tenant') {
      where.tenant = { isNot: null };
    } else if (userType === 'admin') {
      where.admin = { isNot: null };
    }

    return this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        roles: { include: { role: true } },
        resident: { include: { residentUnits: { include: { unit: true } } } },
        owner: true,
        tenant: true,
        admin: true,
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });
  }

  /**
   * Get a single user by ID with all relations
   */
  async getUserWithRelations(id: string): Promise<UserWithRelations> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        resident: { include: { residentUnits: { include: { unit: true } } } },
        owner: true,
        tenant: true,
        admin: true,
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Update user information
   */
  async updateUser(
    id: string,
    data: UpdateUserDto,
  ): Promise<UserWithRelations> {
    const updateData: any = { ...data };

    // Handle password update
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    // Handle roles update
    if (data.roles !== undefined) {
      const roles = data.roles;
      // Use transaction for role updates to ensure consistency
      await this.prisma.$transaction(async (tx) => {
        // Delete existing roles
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        // Create new roles if provided
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((roleId) => ({
              userId: id,
              roleId,
            })),
          });
        }
      });

      // Remove roles from updateData since we've handled it separately
      delete updateData.roles;
    }

    // Verify user exists
    await this.getUserWithRelations(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        roles: { include: { role: true } },
        resident: { include: { residentUnits: { include: { unit: true } } } },
        owner: true,
        tenant: true,
        admin: true,
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });

    return user;
  }

  /**
   * Deactivate (soft delete) a user
   */
  async deactivateUser(id: string): Promise<UserWithRelations> {
    await this.getUserWithRelations(id);

    return this.prisma.user.update({
      where: { id },
      data: { userStatus: UserStatusEnum.DISABLED, updatedAt: new Date() },
      include: {
        roles: { include: { role: true } },
        resident: { include: { residentUnits: { include: { unit: true } } } },
        owner: true,
        tenant: true,
        admin: true,
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });
  }

  async findDashboardUsers(skip: number = 0, take: number = 100) {
    return this.prisma.user.findMany({
      where: { admin: { isNot: null } },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async createDashboardUser(
    data: {
      email: string;
      password: string;
      nameEN: string;
      phone?: string;
      roleIds?: string[];
    },
    options?: { permissions?: string[]; actorUserId?: string },
  ) {
    this.enforceDirectCreationPolicy(options);
    const email = data.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          nameEN: data.nameEN.trim(),
          phone: data.phone?.trim() || null,
          userStatus: UserStatusEnum.ACTIVE,
          signupSource: 'dashboard',
        },
      });

      await tx.admin.create({
        data: {
          userId: user.id,
          status: UserStatusEnum.ACTIVE,
        },
      });

      if (Array.isArray(data.roleIds) && data.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({ userId: user.id, roleId })),
        });
      }

      return user;
    });

    return this.getUserWithRelations(created.id);
  }

  async listRolesWithPermissions() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        users: {
          select: { userId: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions(options?: {
    search?: string;
    groupBy?: 'module';
    page?: number;
    limit?: number;
  }) {
    const search = options?.search?.trim();
    const where = search
      ? {
          key: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : undefined;

    const groupBy = options?.groupBy;
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(500, Math.max(1, options?.limit ?? 100));
    const skip = (page - 1) * limit;

    if (groupBy === 'module') {
      const [total, rows] = await Promise.all([
        this.prisma.permission.count({ where }),
        this.prisma.permission.findMany({
          where,
          orderBy: { key: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      const groupsMap = new Map<
        string,
        Array<{
          id: string;
          key: string;
        }>
      >();

      for (const row of rows) {
        const [moduleName] = row.key.split('.');
        const moduleKey = moduleName || 'misc';
        const group = groupsMap.get(moduleKey) ?? [];
        group.push({ id: row.id, key: row.key });
        groupsMap.set(moduleKey, group);
      }

      const groups = Array.from(groupsMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([module, items]) => ({
          module,
          count: items.length,
          items,
        }));

      return {
        groups,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    return this.prisma.permission.findMany({
      where,
      orderBy: { key: 'asc' },
    });
  }

  async createRoleWithPermissions(input: { name: string; permissionKeys?: string[] }) {
    const roleName = input.name.trim();
    if (!roleName) throw new BadRequestException('Role name is required');

    const existing = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (existing) throw new ConflictException('Role already exists');

    const permissionKeys = Array.from(new Set(input.permissionKeys ?? []));
    const permissions =
      permissionKeys.length > 0
        ? await this.prisma.permission.findMany({
            where: { key: { in: permissionKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (permissions.length !== permissionKeys.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({ data: { name: roleName } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId: createdRole.id,
            permissionId: perm.id,
          })),
        });
      }
      return createdRole;
    });

    await this.permissionCacheService.refresh();
    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }

  async updateRoleWithPermissions(
    roleId: string,
    input: { name: string; permissionKeys?: string[] },
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

    const roleName = input.name.trim();
    if (!roleName) throw new BadRequestException('Role name is required');

    const duplicate = await this.prisma.role.findFirst({
      where: { name: roleName, id: { not: roleId } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Another role already uses this name');

    const permissionKeys = Array.from(new Set(input.permissionKeys ?? []));
    const permissions =
      permissionKeys.length > 0
        ? await this.prisma.permission.findMany({
            where: { key: { in: permissionKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (permissions.length !== permissionKeys.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: { name: roleName },
      });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId,
            permissionId: perm.id,
          })),
        });
      }
    });

    await this.permissionCacheService.refresh();
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        users: { select: { userId: true } },
      },
    });
  }

  async hardDeleteUser(id: string, purgeRelations: boolean = true) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, nameEN: true },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return this.prisma.$transaction(async (tx) => {
      if (!purgeRelations) {
        const blockers = await Promise.all([
          tx.lease.count({ where: { OR: [{ ownerId: id }, { tenantId: id }] } }),
          tx.invoice.count({ where: { residentId: id } }),
          tx.serviceRequest.count({ where: { createdById: id } }),
          tx.booking.count({ where: { userId: id } }),
          tx.complaint.count({ where: { OR: [{ reporterId: id }, { assignedToId: id }] } }),
          tx.violation.count({ where: { OR: [{ issuedById: id }, { residentId: id }] } }),
          tx.ownerUnitContract.count({ where: { ownerUserId: id } }),
        ]);

        if (blockers.some((count) => count > 0)) {
          throw new BadRequestException(
            'Cannot hard delete this user because they have business records. Use purge=true to clean related data.',
          );
        }
      }

      const resident = await tx.resident.findUnique({
        where: { userId: id },
        select: { id: true },
      });

      const leaseRows = await tx.lease.findMany({
        where: { OR: [{ ownerId: id }, { tenantId: id }] },
        select: { id: true, unitId: true },
      });
      const ownerContractRows = await tx.ownerUnitContract.findMany({
        where: { ownerUserId: id },
        select: { id: true, unitId: true },
      });
      const userUnitAccessRows = await tx.unitAccess.findMany({
        where: { userId: id },
        select: { unitId: true },
      });
      const residentUnitRows = resident
        ? await tx.residentUnit.findMany({
            where: { residentId: resident.id },
            select: { unitId: true },
          })
        : [];
      const bookingRows = await tx.booking.findMany({
        where: { userId: id },
        select: { id: true, unitId: true },
      });
      const serviceRequestRows = await tx.serviceRequest.findMany({
        where: { createdById: id },
        select: { id: true, unitId: true },
      });
      const complaintRows = await tx.complaint.findMany({
        where: { reporterId: id },
        select: { id: true, unitId: true },
      });
      const violationRows = await tx.violation.findMany({
        where: { OR: [{ residentId: id }, { issuedById: id }] },
        select: { id: true, unitId: true },
      });

      const touchedUnitIds = Array.from(
        new Set(
          [
            ...leaseRows.map((row) => row.unitId),
            ...ownerContractRows.map((row) => row.unitId),
            ...userUnitAccessRows.map((row) => row.unitId),
            ...residentUnitRows.map((row) => row.unitId),
            ...bookingRows
              .map((row) => row.unitId)
              .filter((value): value is string => typeof value === 'string'),
            ...serviceRequestRows
              .map((row) => row.unitId)
              .filter((value): value is string => typeof value === 'string'),
            ...complaintRows
              .map((row) => row.unitId)
              .filter((value): value is string => typeof value === 'string'),
            ...violationRows.map((row) => row.unitId),
          ].filter((value): value is string => typeof value === 'string'),
        ),
      );

      const leaseIds = leaseRows.map((row) => row.id);
      const ownerContractIds = ownerContractRows.map((row) => row.id);
      const bookingIds = bookingRows.map((row) => row.id);
      const serviceRequestIds = serviceRequestRows.map((row) => row.id);
      const complaintIds = complaintRows.map((row) => row.id);
      const violationIds = violationRows.map((row) => row.id);

      await tx.notification.updateMany({
        where: { senderId: id },
        data: { senderId: null },
      });

      await tx.profileChangeRequest.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.familyAccessRequest.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.authorizedAccessRequest.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.homeStaffAccess.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.rentRequest.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.violationActionRequest.updateMany({
        where: { reviewedById: id },
        data: { reviewedById: null },
      });
      await tx.complaint.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.violation.updateMany({
        where: { issuedById: id },
        data: { issuedById: null },
      });
      await tx.violation.updateMany({
        where: { residentId: id },
        data: { residentId: null },
      });
      await tx.invoice.updateMany({
        where: { residentId: id },
        data: { residentId: null },
      });

      if (serviceRequestIds.length > 0) {
        await tx.invoice.updateMany({
          where: { serviceRequestId: { in: serviceRequestIds } },
          data: { serviceRequestId: null },
        });
        await tx.attachment.deleteMany({
          where: { serviceRequestId: { in: serviceRequestIds } },
        });
        await tx.serviceRequestComment.deleteMany({
          where: { requestId: { in: serviceRequestIds } },
        });
        await tx.serviceRequestFieldValue.deleteMany({
          where: { requestId: { in: serviceRequestIds } },
        });
        await tx.serviceRequest.deleteMany({
          where: { id: { in: serviceRequestIds } },
        });
      }

      if (bookingIds.length > 0) {
        await tx.invoice.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { bookingId: null },
        });
      }

      if (complaintIds.length > 0) {
        await tx.invoice.updateMany({
          where: { complaintId: { in: complaintIds } },
          data: { complaintId: null },
        });
        await tx.complaintComment.deleteMany({
          where: { complaintId: { in: complaintIds } },
        });
        await tx.complaint.deleteMany({
          where: { id: { in: complaintIds } },
        });
      }

      if (violationIds.length > 0) {
        await tx.invoice.updateMany({
          where: { violationId: { in: violationIds } },
          data: { violationId: null },
        });
        await tx.violationActionRequest.deleteMany({
          where: { violationId: { in: violationIds } },
        });
        await tx.violation.deleteMany({
          where: { id: { in: violationIds } },
        });
      }

      if (bookingIds.length > 0) {
        await tx.booking.deleteMany({
          where: { id: { in: bookingIds } },
        });
      }

      if (leaseIds.length > 0) {
        await tx.lease.deleteMany({
          where: { id: { in: leaseIds } },
        });
      }

      if (ownerContractIds.length > 0) {
        await tx.ownerInstallment.deleteMany({
          where: { ownerUnitContractId: { in: ownerContractIds } },
        });
        await tx.ownerUnitContract.deleteMany({
          where: { id: { in: ownerContractIds } },
        });
      }

      await tx.profileChangeRequest.deleteMany({ where: { userId: id } });
      await tx.familyAccessRequest.deleteMany({
        where: { OR: [{ ownerUserId: id }, { activatedUserId: id }] },
      });
      await tx.authorizedAccessRequest.deleteMany({
        where: { OR: [{ ownerUserId: id }, { activatedUserId: id }] },
      });
      await tx.homeStaffAccess.deleteMany({ where: { ownerUserId: id } });
      await tx.violationActionRequest.deleteMany({ where: { requestedById: id } });
      await tx.referral.deleteMany({
        where: { OR: [{ referrerId: id }, { convertedUserId: id }] },
      });
      await tx.clubhouseAccessRequest.deleteMany({ where: { userId: id } });
      await tx.notificationDeviceToken.deleteMany({ where: { userId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
      await tx.phoneVerificationOtp.deleteMany({ where: { userId: id } });
      await tx.userStatusLog.deleteMany({ where: { userId: id } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.contractorMember.deleteMany({ where: { userId: id } });
      await tx.unitAccess.deleteMany({ where: { userId: id } });
      await tx.accessQRCode.deleteMany({ where: { generatedById: id } });
      await tx.serviceRequestComment.deleteMany({ where: { createdById: id } });
      await tx.complaintComment.deleteMany({ where: { createdById: id } });
      await tx.residentUnit.deleteMany({
        where: { resident: { userId: id } },
      });
      await tx.familyMember.deleteMany({
        where: {
          OR: [
            { primaryResident: { userId: id } },
            { familyResident: { userId: id } },
          ],
        },
      });
      await tx.residentDocument.deleteMany({ where: { resident: { userId: id } } });
      await tx.residentVehicle.deleteMany({ where: { resident: { userId: id } } });
      await tx.resident.deleteMany({ where: { userId: id } });
      await tx.owner.deleteMany({ where: { userId: id } });
      await tx.tenant.deleteMany({ where: { userId: id } });
      await tx.admin.deleteMany({ where: { userId: id } });

      await tx.user.delete({ where: { id } });

      if (touchedUnitIds.length > 0) {
        await tx.unit.updateMany({
          where: { id: { in: touchedUnitIds } },
          data: { status: UnitStatus.AVAILABLE },
        });
      }

      return {
        success: true,
        deletedUserId: id,
        deletedEmail: user.email ?? null,
        deletedName: user.nameEN ?? null,
        unitIdsResetToAvailable: touchedUnitIds,
      };
    });
  }

  // ===== RESIDENT MANAGEMENT =====

  /**
   * Create a resident profile for an existing user
   */
  async createResident(
    data: CreateResidentDto,
    options?: { permissions?: string[] },
  ): Promise<ResidentWithUser> {
    this.enforceDirectCreationPolicy(options);

    await this.getUserWithRelations(data.userId);

    const existing = await this.prisma.resident.findUnique({
      where: { userId: data.userId },
    });

    if (existing) {
      throw new ConflictException(
        `Resident profile already exists for user ${data.userId}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data,
        include: { user: true },
      });

      const communityRole = await tx.role.findUnique({
        where: { name: 'COMMUNITY_USER' },
        select: { id: true },
      });
      if (communityRole) {
        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: data.userId,
              roleId: communityRole.id,
            },
          },
          create: {
            userId: data.userId,
            roleId: communityRole.id,
          },
          update: {},
        });
      }

      return resident;
    });
  }

  /**
   * Get all residents
   */
  async findAllResidents(
    skip: number = 0,
    take: number = 20,
  ): Promise<ResidentWithUser[]> {
    return this.prisma.resident.findMany({
      skip,
      take,
      orderBy: { user: { createdAt: 'desc' } },
      include: { user: true },
    });
  }

  /**
   * Get a single resident
   */
  async getResident(id: string): Promise<ResidentWithUser> {
    const resident = await this.prisma.resident.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!resident) {
      throw new NotFoundException(`Resident with ID ${id} not found`);
    }

    return resident;
  }

  /**
   * Get resident by user ID
   */
  async getResidentByUserId(userId: string): Promise<ResidentWithUser> {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!resident) {
      throw new NotFoundException(
        `Resident profile not found for user ${userId}`,
      );
    }

    return resident;
  }

  /**
   * Update a resident
   */
  async updateResident(
    id: string,
    data: UpdateResidentDto,
  ): Promise<ResidentWithUser> {
    // Verify resident exists
    await this.getResident(id);

    return this.prisma.resident.update({
      where: { id },
      data,
      include: { user: true },
    });
  }

  /**
   * Delete a resident profile with cascading cleanup
   */
  async deleteResident(id: string): Promise<ResidentWithUser> {
    const resident = await this.getResident(id);

    // Use transaction to ensure atomic cleanup
    await this.prisma.$transaction(async (tx) => {
      // Clean up resident units
      await tx.residentUnit.deleteMany({
        where: { residentId: resident.id },
      });

      // Clean up bookings
      await tx.booking.deleteMany({
        where: { residentId: resident.id },
      });

      // Delete the resident profile
      await tx.resident.delete({
        where: { id },
      });
    });

    return resident;
  }

  async getResidentOverview(userId: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            unitAccesses: {
              where: { status: 'ACTIVE' },
              include: {
                unit: {
                  select: {
                    id: true,
                    projectName: true,
                    block: true,
                    unitNumber: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        residentUnits: {
          include: {
            unit: {
              select: {
                id: true,
                projectName: true,
                block: true,
                unitNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    const residentUnitIds = Array.from(
      new Set(
        resident.residentUnits
          .map((row) => row.unitId)
          .concat(resident.user.unitAccesses.map((row) => row.unitId)),
      ),
    );

    const contracts = residentUnitIds.length
      ? await this.prisma.ownerUnitContract.findMany({
          where: {
            unitId: { in: residentUnitIds },
          },
          include: {
            unit: {
              select: {
                id: true,
                projectName: true,
                block: true,
                unitNumber: true,
                status: true,
              },
            },
            ownerUser: {
              select: {
                id: true,
                nameEN: true,
                email: true,
                phone: true,
              },
            },
            contractFile: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                category: true,
                createdAt: true,
              },
            },
            installments: {
              orderBy: { sequence: 'asc' },
              include: {
                referenceFile: {
                  select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    category: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        })
      : [];

    const [householdTree, documents] = await Promise.all([
      this.getResidentHouseholdTree(userId),
      this.getResidentDocuments(userId),
    ]);

    return {
      resident: {
        id: resident.id,
        nationalId: resident.nationalId,
        dateOfBirth: resident.dateOfBirth,
        user: resident.user,
      },
      units: {
        residentUnits: resident.residentUnits,
        unitAccesses: resident.user.unitAccesses,
      },
      ownership: contracts,
      household: householdTree,
      documents,
    };
  }

  async updateResidentFullProfile(
    userId: string,
    data: UpdateResidentProfileAdminDto,
  ) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    const { dateOfBirth, nationalId, ...userFields } = data;
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userFields).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userFields,
        });
      }
      if (dateOfBirth !== undefined || nationalId !== undefined) {
        await tx.resident.update({
          where: { userId },
          data: {
            ...(dateOfBirth !== undefined
              ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
              : {}),
            ...(nationalId !== undefined ? { nationalId: nationalId || null } : {}),
          },
        });
      }
    });

    return this.getResidentOverview(userId);
  }

  async assignUnitToResidentUser(userId: string, dto: AssignResidentUnitDto) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, status: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${dto.unitId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const residentUnit = await tx.residentUnit.upsert({
        where: {
          residentId_unitId: {
            residentId: resident.id,
            unitId: dto.unitId,
          },
        },
        update: {
          isPrimary: dto.role === 'OWNER',
        },
        create: {
          residentId: resident.id,
          unitId: dto.unitId,
          isPrimary: dto.role === 'OWNER',
        },
        include: { unit: true },
      });

      const now = new Date();
      const existingAccess = await tx.unitAccess.findFirst({
        where: {
          unitId: dto.unitId,
          userId,
          role: dto.role,
        },
        select: { id: true },
      });
      if (existingAccess) {
        await tx.unitAccess.update({
          where: { id: existingAccess.id },
          data: {
            status: 'ACTIVE',
            startsAt: now,
            endsAt: null,
            source: 'ADMIN_ASSIGNMENT',
            canViewFinancials: dto.role === 'OWNER',
            canReceiveBilling: dto.role === 'OWNER',
            canBookFacilities: true,
            canGenerateQR: dto.role !== 'FAMILY',
            canManageWorkers: dto.role === 'OWNER',
          },
        });
      } else {
        await tx.unitAccess.create({
          data: {
            unitId: dto.unitId,
            userId,
            role: dto.role,
            status: 'ACTIVE',
            startsAt: now,
            source: 'ADMIN_ASSIGNMENT',
            grantedBy: userId,
            canViewFinancials: dto.role === 'OWNER',
            canReceiveBilling: dto.role === 'OWNER',
            canBookFacilities: true,
            canGenerateQR: dto.role !== 'FAMILY',
            canManageWorkers: dto.role === 'OWNER',
          },
        });
      }

      return residentUnit;
    });
  }

  async removeUnitFromResidentUser(userId: string, unitId: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.residentUnit.deleteMany({
        where: {
          residentId: resident.id,
          unitId,
        },
      });

      await tx.unitAccess.updateMany({
        where: {
          unitId,
          userId,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          endsAt: new Date(),
        },
      });

      return { success: true };
    });
  }

  async transferUnitOwnership(
    unitId: string,
    dto: TransferOwnershipDto,
    actorUserId: string,
  ) {
    if (dto.mode === 'CREATE_NEW_PLAN' && !dto.newPlan) {
      throw new BadRequestException(
        'newPlan payload is required for CREATE_NEW_PLAN mode',
      );
    }
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('fromUserId and toUserId cannot be the same');
    }

    return this.prisma.$transaction(async (tx) => {
      const [unit, fromResident, toResident] = await Promise.all([
        tx.unit.findUnique({ where: { id: unitId }, select: { id: true } }),
        tx.resident.findUnique({
          where: { userId: dto.fromUserId },
          select: { id: true },
        }),
        tx.resident.findUnique({
          where: { userId: dto.toUserId },
          select: { id: true },
        }),
      ]);

      if (!unit) throw new NotFoundException('Unit not found');
      if (!fromResident) throw new NotFoundException('Source resident not found');
      if (!toResident) throw new NotFoundException('Target resident not found');

      const sourceResidentUnit = await tx.residentUnit.findUnique({
        where: {
          residentId_unitId: {
            residentId: fromResident.id,
            unitId,
          },
        },
      });
      if (!sourceResidentUnit) {
        throw new BadRequestException('Source user is not linked to this unit');
      }

      await tx.owner.upsert({
        where: { userId: dto.toUserId },
        create: { userId: dto.toUserId },
        update: {},
      });

      const now = new Date();
      await tx.unitAccess.updateMany({
        where: {
          unitId,
          userId: dto.fromUserId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        data: {
          status: 'REVOKED',
          endsAt: now,
        },
      });

      await tx.residentUnit.update({
        where: {
          residentId_unitId: {
            residentId: fromResident.id,
            unitId,
          },
        },
        data: { isPrimary: false },
      });

      await tx.residentUnit.upsert({
        where: {
          residentId_unitId: {
            residentId: toResident.id,
            unitId,
          },
        },
        create: {
          residentId: toResident.id,
          unitId,
          isPrimary: true,
        },
        update: {
          isPrimary: true,
        },
      });

      const targetOwnerAccess = await tx.unitAccess.findFirst({
        where: {
          unitId,
          userId: dto.toUserId,
          role: 'OWNER',
        },
        select: { id: true },
      });
      if (targetOwnerAccess) {
        await tx.unitAccess.update({
          where: { id: targetOwnerAccess.id },
          data: {
            status: 'ACTIVE',
            startsAt: now,
            endsAt: null,
            source: 'ADMIN_ASSIGNMENT',
            grantedBy: actorUserId,
            canViewFinancials: true,
            canReceiveBilling: true,
            canBookFacilities: true,
            canGenerateQR: true,
            canManageWorkers: true,
          },
        });
      } else {
        await tx.unitAccess.create({
          data: {
            unitId,
            userId: dto.toUserId,
            role: 'OWNER',
            status: 'ACTIVE',
            startsAt: now,
            source: 'ADMIN_ASSIGNMENT',
            grantedBy: actorUserId,
            canViewFinancials: true,
            canReceiveBilling: true,
            canBookFacilities: true,
            canGenerateQR: true,
            canManageWorkers: true,
          },
        });
      }

      let movedContractId: string | null = null;
      let createdContractId: string | null = null;
      let transferredInstallmentsCount = 0;

      const sourceContract = await tx.ownerUnitContract.findFirst({
        where: {
          ownerUserId: dto.fromUserId,
          unitId,
          archivedAt: null,
        },
        include: {
          installments: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (dto.mode === 'MOVE_EXISTING_PLAN') {
        if (!sourceContract) {
          throw new BadRequestException(
            'No existing active owner contract found to move',
          );
        }

        const moved = await tx.ownerUnitContract.update({
          where: { id: sourceContract.id },
          data: {
            ownerUserId: dto.toUserId,
          },
        });
        movedContractId = moved.id;
        transferredInstallmentsCount = sourceContract.installments.length;
      } else {
        const newPlan = dto.newPlan!;
        if (sourceContract) {
          await tx.ownerUnitContract.update({
            where: { id: sourceContract.id },
            data: { archivedAt: now },
          });
        }

        const createdContract = await tx.ownerUnitContract.create({
          data: {
            ownerUserId: dto.toUserId,
            unitId,
            paymentMode: newPlan.paymentMode,
            contractFileId: newPlan.contractFileId,
            contractSignedAt: newPlan.contractSignedAt
              ? new Date(newPlan.contractSignedAt)
              : null,
            notes: newPlan.notes?.trim() || null,
            createdById: actorUserId,
          },
        });
        createdContractId = createdContract.id;

        if (newPlan.installments?.length) {
          await tx.ownerInstallment.createMany({
            data: newPlan.installments.map((item, index) => ({
              ownerUnitContractId: createdContract.id,
              sequence: index + 1,
              dueDate: new Date(item.dueDate),
              amount: item.amount,
              referenceFileId: item.referenceFileId,
              referencePageIndex: item.referencePageIndex,
            })),
          });
          transferredInstallmentsCount = newPlan.installments.length;
        }
      }

      const transfer = await tx.unitOwnershipTransfer.create({
        data: {
          unitId,
          fromUserId: dto.fromUserId,
          toUserId: dto.toUserId,
          transferMode: dto.mode,
          movedContractId,
          createdContractId,
          transferredInstallmentsCount,
          transferredById: actorUserId,
          notes: dto.notes?.trim() || null,
        },
      });

      return {
        success: true,
        transfer,
      };
    });
  }

  async getResidentHouseholdTree(userId: string, unitId?: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            nameEN: true,
            email: true,
            phone: true,
            userStatus: true,
          },
        },
        residentUnits: {
          include: {
            unit: {
              select: {
                id: true,
                projectName: true,
                block: true,
                unitNumber: true,
              },
            },
          },
        },
      },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    const unitFilter = unitId ? { unitId } : {};
    const [familyRequests, authorizedRequests, homeStaffRequests] =
      await Promise.all([
        this.prisma.familyAccessRequest.findMany({
          where: { ownerUserId: userId, ...unitFilter },
          include: {
            unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
            activatedUser: {
              select: {
                id: true,
                nameEN: true,
                email: true,
                phone: true,
                userStatus: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.authorizedAccessRequest.findMany({
          where: { ownerUserId: userId, ...unitFilter },
          include: {
            unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
            activatedUser: {
              select: {
                id: true,
                nameEN: true,
                email: true,
                phone: true,
                userStatus: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.homeStaffAccess.findMany({
          where: { ownerUserId: userId, ...unitFilter },
          include: {
            unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      root: {
        type: 'RESIDENT',
        residentId: resident.id,
        user: resident.user,
        units: resident.residentUnits.map((row) => ({
          unitId: row.unitId,
          isPrimary: row.isPrimary,
          assignedAt: row.assignedAt,
          unit: row.unit,
        })),
      },
      children: {
        family: familyRequests.map((row) => ({
          type: 'FAMILY',
          id: row.id,
          status: row.status,
          relationship: row.relationship,
          fullName: row.fullName,
          phone: row.phone,
          email: row.email,
          unit: row.unit,
          activatedUser: row.activatedUser,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
        })),
        authorized: authorizedRequests.map((row) => ({
          type: 'AUTHORIZED',
          id: row.id,
          status: row.status,
          fullName: row.fullName,
          phone: row.phone,
          email: row.email,
          unit: row.unit,
          validFrom: row.validFrom,
          validTo: row.validTo,
          activatedUser: row.activatedUser,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
        })),
        homeStaff: homeStaffRequests.map((row) => ({
          type: 'HOME_STAFF',
          id: row.id,
          status: row.status,
          fullName: row.fullName,
          phone: row.phone,
          staffType: row.staffType,
          unit: row.unit,
          accessValidFrom: row.accessValidFrom,
          accessValidTo: row.accessValidTo,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
        })),
      },
    };
  }

  async getResidentDocuments(userId: string) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            profilePhotoId: true,
            nationalIdFileId: true,
          },
        },
        residentUnits: {
          select: {
            unitId: true,
          },
        },
        documents: {
          include: {
            file: true,
          },
        },
      },
    });
    if (!resident) {
      throw new NotFoundException(`Resident profile not found for user ${userId}`);
    }

    const unitIds = resident.residentUnits.map((row) => row.unitId);
    const [contracts, family, authorized, staff] = await Promise.all([
      this.prisma.ownerUnitContract.findMany({
        where: {
          OR: [{ ownerUserId: userId }, ...(unitIds.length ? [{ unitId: { in: unitIds } }] : [])],
        },
        include: {
          contractFile: true,
          installments: {
            include: {
              referenceFile: true,
            },
          },
          unit: {
            select: {
              id: true,
              projectName: true,
              block: true,
              unitNumber: true,
            },
          },
        },
      }),
      this.prisma.familyAccessRequest.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          unitId: true,
          personalPhotoFileId: true,
          nationalIdFileId: true,
          passportFileId: true,
          birthCertificateFileId: true,
          marriageCertificateFileId: true,
          unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
        },
      }),
      this.prisma.authorizedAccessRequest.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          unitId: true,
          idOrPassportFileId: true,
          powerOfAttorneyFileId: true,
          personalPhotoFileId: true,
          unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
        },
      }),
      this.prisma.homeStaffAccess.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          unitId: true,
          idOrPassportFileId: true,
          personalPhotoFileId: true,
          unit: { select: { id: true, projectName: true, block: true, unitNumber: true } },
        },
      }),
    ]);

    const documents: Array<{
      category: string;
      source: string;
      unit?: unknown;
      file: unknown;
      extra?: unknown;
      uploadedAt: Date | string;
    }> = [];

    const pushFile = (
      file: Prisma.FileGetPayload<{}> | null | undefined,
      input: {
        category: string;
        source: string;
        unit?: unknown;
        extra?: unknown;
      },
    ) => {
      if (!file) return;
      documents.push({
        category: input.category,
        source: input.source,
        unit: input.unit,
        file: {
          id: file.id,
          name: file.name,
          key: file.key,
          mimeType: file.mimeType,
          size: file.size,
          category: file.category,
        },
        extra: input.extra,
        uploadedAt: file.createdAt,
      });
    };

    if (resident.user.profilePhotoId) {
      const file = await this.prisma.file.findUnique({
        where: { id: resident.user.profilePhotoId },
      });
      pushFile(file, {
        category: 'PROFILE_PHOTO',
        source: 'USER_PROFILE',
      });
    }

    if (resident.user.nationalIdFileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: resident.user.nationalIdFileId },
      });
      pushFile(file, {
        category: 'NATIONAL_ID',
        source: 'USER_PROFILE',
      });
    }

    for (const residentDoc of resident.documents) {
      pushFile(residentDoc.file, {
        category: residentDoc.type,
        source: 'RESIDENT_DOCUMENT',
      });
    }

    for (const contract of contracts) {
      pushFile(contract.contractFile, {
        category: 'CONTRACT',
        source: 'OWNER_CONTRACT',
        unit: contract.unit,
        extra: {
          contractId: contract.id,
          paymentMode: contract.paymentMode,
          signedAt: contract.contractSignedAt,
        },
      });
      for (const installment of contract.installments) {
        pushFile(installment.referenceFile, {
          category: 'INSTALLMENT_REFERENCE',
          source: 'OWNER_INSTALLMENT',
          unit: contract.unit,
          extra: {
            contractId: contract.id,
            installmentId: installment.id,
            sequence: installment.sequence,
            dueDate: installment.dueDate,
            status: installment.status,
          },
        });
      }
    }

    for (const familyRequest of family) {
      const fileIds = [
        familyRequest.personalPhotoFileId,
        familyRequest.nationalIdFileId,
        familyRequest.passportFileId,
        familyRequest.birthCertificateFileId,
        familyRequest.marriageCertificateFileId,
      ].filter(Boolean) as string[];
      for (const fileId of fileIds) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        pushFile(file, {
          category: 'FAMILY_REQUEST_DOCUMENT',
          source: 'FAMILY_REQUEST',
          unit: familyRequest.unit,
          extra: { requestId: familyRequest.id },
        });
      }
    }

    for (const authorizedRequest of authorized) {
      const fileIds = [
        authorizedRequest.idOrPassportFileId,
        authorizedRequest.powerOfAttorneyFileId,
        authorizedRequest.personalPhotoFileId,
      ].filter(Boolean) as string[];
      for (const fileId of fileIds) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        pushFile(file, {
          category: 'AUTHORIZED_REQUEST_DOCUMENT',
          source: 'AUTHORIZED_REQUEST',
          unit: authorizedRequest.unit,
          extra: { requestId: authorizedRequest.id },
        });
      }
    }

    for (const staffRequest of staff) {
      const fileIds = [staffRequest.idOrPassportFileId, staffRequest.personalPhotoFileId].filter(
        Boolean,
      ) as string[];
      for (const fileId of fileIds) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        pushFile(file, {
          category: 'HOME_STAFF_DOCUMENT',
          source: 'HOME_STAFF',
          unit: staffRequest.unit,
          extra: { requestId: staffRequest.id },
        });
      }
    }

    documents.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    return {
      total: documents.length,
      documents,
    };
  }

  // ===== OWNER MANAGEMENT =====

  /**
   * Create an owner profile for an existing user
   */
  async createOwner(
    data: CreateOwnerDto,
    options?: { permissions?: string[] },
  ): Promise<OwnerWithUser> {
    this.enforceDirectCreationPolicy(options);

    await this.getUserWithRelations(data.userId);

    const existing = await this.prisma.owner.findUnique({
      where: { userId: data.userId },
    });

    if (existing) {
      throw new ConflictException(
        `Owner profile already exists for user ${data.userId}`,
      );
    }

    return this.prisma.owner.create({
      data,
      include: { user: true },
    });
  }

  /**
   * Get all owners
   */
  async findAllOwners(
    skip: number = 0,
    take: number = 20,
  ): Promise<OwnerWithUser[]> {
    return this.prisma.owner.findMany({
      skip,
      take,
      orderBy: { user: { createdAt: 'desc' } },
      include: { user: true },
    });
  }

  /**
   * Get a single owner
   */
  async getOwner(id: string): Promise<OwnerWithUser> {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${id} not found`);
    }

    return owner;
  }

  /**
   * Get owner by user ID
   */
  async getOwnerByUserId(userId: string): Promise<OwnerWithUser> {
    const owner = await this.prisma.owner.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!owner) {
      throw new NotFoundException(`Owner profile not found for user ${userId}`);
    }

    return owner;
  }

  /**
   * Update an owner
   */
  async updateOwner(id: string, data: UpdateOwnerDto): Promise<OwnerWithUser> {
    await this.getOwner(id);

    return this.prisma.owner.update({
      where: { id },
      data,
      include: { user: true },
    });
  }

  /**
   * Delete an owner profile
   */
  async deleteOwner(id: string): Promise<OwnerWithUser> {
    await this.getOwner(id);

    return this.prisma.owner.delete({
      where: { id },
      include: { user: true },
    });
  }

  // ===== TENANT MANAGEMENT =====

  /**
   * Create a tenant profile for an existing user
   */
  async createTenant(
    data: CreateTenantDto,
    options?: { permissions?: string[] },
  ): Promise<TenantWithUser> {
    this.enforceDirectCreationPolicy(options);

    await this.getUserWithRelations(data.userId);

    const existing = await this.prisma.tenant.findUnique({
      where: { userId: data.userId },
    });

    if (existing) {
      throw new ConflictException(
        `Tenant profile already exists for user ${data.userId}`,
      );
    }

    return this.prisma.tenant.create({
      data,
      include: { user: true },
    });
  }

  /**
   * Get all tenants
   */
  async findAllTenants(
    skip: number = 0,
    take: number = 20,
  ): Promise<TenantWithUser[]> {
    return this.prisma.tenant.findMany({
      skip,
      take,
      orderBy: { user: { createdAt: 'desc' } },
      include: { user: true },
    });
  }

  /**
   * Get a single tenant
   */
  async getTenant(id: string): Promise<TenantWithUser> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  /**
   * Get tenant by user ID
   */
  async getTenantByUserId(userId: string): Promise<TenantWithUser> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!tenant) {
      throw new NotFoundException(
        `Tenant profile not found for user ${userId}`,
      );
    }

    return tenant;
  }

  /**
   * Update a tenant
   */
  async updateTenant(
    id: string,
    data: UpdateTenantDto,
  ): Promise<TenantWithUser> {
    await this.getTenant(id);

    return this.prisma.tenant.update({
      where: { id },
      data,
      include: { user: true },
    });
  }

  /**
   * Delete a tenant profile
   */
  async deleteTenant(id: string): Promise<TenantWithUser> {
    await this.getTenant(id);

    return this.prisma.tenant.delete({
      where: { id },
      include: { user: true },
    });
  }

  // ===== ADMIN MANAGEMENT =====

  /**
   * Create an admin profile for an existing user
   */
  async createAdmin(
    data: CreateAdminDto,
    options?: { permissions?: string[] },
  ): Promise<AdminWithUser> {
    this.enforceDirectCreationPolicy(options);

    await this.getUserWithRelations(data.userId);

    const existing = await this.prisma.admin.findUnique({
      where: { userId: data.userId },
    });

    if (existing) {
      throw new ConflictException(
        `Admin profile already exists for user ${data.userId}`,
      );
    }

    return this.prisma.admin.create({
      data: {
        userId: data.userId,
        status: data.status
          ? (data.status as UserStatusEnum)
          : UserStatusEnum.ACTIVE,
      },
      include: { user: true },
    });
  }

  /**
   * Get all admins
   */
  async findAllAdmins(
    skip: number = 0,
    take: number = 20,
  ): Promise<AdminWithUser[]> {
    return this.prisma.admin.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  /**
   * Get a single admin
   */
  async getAdmin(id: string): Promise<AdminWithUser> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    return admin;
  }

  /**
   * Get admin by user ID
   */
  async getAdminByUserId(userId: string): Promise<AdminWithUser> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!admin) {
      throw new NotFoundException(`Admin profile not found for user ${userId}`);
    }

    return admin;
  }

  /**
   * Update an admin
   */
  async updateAdmin(id: string, data: UpdateAdminDto): Promise<AdminWithUser> {
    await this.getAdmin(id);

    const { userId, ...updateData } = data;

    const updatePayload: any = {};
    if (updateData.status) {
      updatePayload.status = updateData.status as UserStatusEnum;
    }

    return this.prisma.admin.update({
      where: { id },
      data: updatePayload,
      include: { user: true },
    });
  }

  /**
   * Delete an admin profile
   */
  async deleteAdmin(id: string): Promise<AdminWithUser> {
    await this.getAdmin(id);

    return this.prisma.admin.delete({
      where: { id },
      include: { user: true },
    });
  }
}
