import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AccessStatus,
  DelegateType,
  HouseholdRequestStatus,
  Prisma,
  UnitAccessRole,
  UserStatusEnum,
  UnitStatus,
  UserStatusLogSource,
} from '@prisma/client';
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
import { CreateBrokerDto, UpdateBrokerDto } from './dto/broker.dto';
import { ListCompoundStaffDto } from '../compound-staff/dto/list-compound-staff.dto';
import { CompoundStaffService } from '../compound-staff/compound-staff.service';
import {
  ListBrokersQueryDto,
  ListDelegatesQueryDto,
  ListFamilyMembersQueryDto,
  ListHomeStaffQueryDto,
  ListOwnersQueryDto,
  ListSystemUsersQueryDto,
  ListTenantsQueryDto,
} from './dto/users-hub-query.dto';
import {
  BrokerResponseDto,
  DelegateListItemDto,
  FamilyMemberListItemDto,
  HomeStaffListItemDto,
  LeaseItemDto,
  OwnerListItemDto,
  PaginatedResponseDto,
  SystemUserListItemDto,
  TenantListItemDto,
  UnitItemDto,
  UserDetailResponseDto,
  UserItemDto,
  UserStatsResponseDto,
  UserTypeValue,
} from './dto/users-hub-response.dto';
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
    private compoundStaffService: CompoundStaffService,
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
        resident: {
          include: {
            residentUnits: { include: { unit: true } },
            familyOf: {
              include: {
                primaryResident: {
                  include: { user: { select: { id: true, nameEN: true, email: true, phone: true } } },
                },
              },
            },
          },
        },
        owner: true,
        tenant: true,
        broker: true,
        admin: true,
        unitAccesses: {
          where: { status: 'ACTIVE' as any },
          select: { id: true, role: true, unitId: true, delegateType: true },
        },
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
        statusPermissions: {
          include: { permission: true },
        },
        moduleAccess: true,
        personas: {
          include: { persona: true },
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

  async createRoleWithPermissions(input: {
    name: string;
    description?: string;
    permissionKeys?: string[];
    moduleKeys?: string[];
    personaKeys?: string[];
    statusPermissions?: Record<string, string[]>;
  }) {
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

    const personaKeys = Array.from(new Set(input.personaKeys ?? []));
    const personas =
      personaKeys.length > 0
        ? await this.prisma.persona.findMany({
            where: { key: { in: personaKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (personas.length !== personaKeys.length) {
      throw new BadRequestException('One or more personas are invalid');
    }

    // Resolve status permissions
    const statusPermData = await this.resolveStatusPermissionInput(input.statusPermissions);

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          name: roleName,
          description: input.description?.trim() || null,
        },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId: createdRole.id,
            permissionId: perm.id,
          })),
        });
      }

      // Module access
      const moduleKeys = input.moduleKeys ?? [];
      if (moduleKeys.length > 0) {
        await tx.roleModuleAccess.createMany({
          data: moduleKeys.map((moduleKey) => ({
            roleId: createdRole.id,
            moduleKey,
            canAccess: true,
          })),
        });
      }

      if (personas.length > 0) {
        await tx.rolePersona.createMany({
          data: personas.map((persona) => ({
            roleId: createdRole.id,
            personaId: persona.id,
          })),
        });
      }

      // Status permissions
      if (statusPermData.length > 0) {
        await tx.roleStatusPermission.createMany({
          data: statusPermData.map((sp) => ({
            roleId: createdRole.id,
            unitStatus: sp.unitStatus,
            permissionId: sp.permissionId,
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
        statusPermissions: { include: { permission: true } },
        moduleAccess: true,
        personas: { include: { persona: true } },
        users: { select: { userId: true } },
      },
    });
  }

  private async resolveStatusPermissionInput(
    statusPermissions?: Record<string, string[]>,
  ): Promise<Array<{ unitStatus: UnitStatus; permissionId: string }>> {
    if (!statusPermissions) return [];

    const result: Array<{ unitStatus: UnitStatus; permissionId: string }> = [];
    const allKeys = new Set<string>();
    for (const keys of Object.values(statusPermissions)) {
      for (const key of keys) allKeys.add(key);
    }
    if (allKeys.size === 0) return [];

    const perms = await this.prisma.permission.findMany({
      where: { key: { in: Array.from(allKeys) } },
      select: { id: true, key: true },
    });
    const keyToId = new Map(perms.map((p) => [p.key, p.id]));

    for (const [status, keys] of Object.entries(statusPermissions)) {
      const unitStatus = status as UnitStatus;
      for (const key of keys) {
        const permId = keyToId.get(key);
        if (permId) {
          result.push({ unitStatus, permissionId: permId });
        }
      }
    }
    return result;
  }

  async updateRoleWithPermissions(
    roleId: string,
    input: {
      name: string;
      description?: string;
      permissionKeys?: string[];
      moduleKeys?: string[];
      personaKeys?: string[];
      statusPermissions?: Record<string, string[]>;
    },
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

    const personaKeys = Array.from(new Set(input.personaKeys ?? []));
    const personas =
      personaKeys.length > 0
        ? await this.prisma.persona.findMany({
            where: { key: { in: personaKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (input.personaKeys !== undefined && personas.length !== personaKeys.length) {
      throw new BadRequestException('One or more personas are invalid');
    }

    const statusPermData = await this.resolveStatusPermissionInput(input.statusPermissions);

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          name: roleName,
          description: input.description?.trim() ?? role.description,
        },
      });

      // Replace base permissions
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId,
            permissionId: perm.id,
          })),
        });
      }

      // Replace module access
      if (input.moduleKeys !== undefined) {
        await tx.roleModuleAccess.deleteMany({ where: { roleId } });
        if (input.moduleKeys.length > 0) {
          await tx.roleModuleAccess.createMany({
            data: input.moduleKeys.map((moduleKey) => ({
              roleId,
              moduleKey,
              canAccess: true,
            })),
          });
        }
      }

      if (input.personaKeys !== undefined) {
        await tx.rolePersona.deleteMany({ where: { roleId } });
        if (personas.length > 0) {
          await tx.rolePersona.createMany({
            data: personas.map((persona) => ({
              roleId,
              personaId: persona.id,
            })),
          });
        }
      }

      // Replace status permissions
      if (input.statusPermissions !== undefined) {
        await tx.roleStatusPermission.deleteMany({ where: { roleId } });
        if (statusPermData.length > 0) {
          await tx.roleStatusPermission.createMany({
            data: statusPermData.map((sp) => ({
              roleId,
              unitStatus: sp.unitStatus,
              permissionId: sp.permissionId,
            })),
          });
        }
      }
    });

    await this.permissionCacheService.refresh();
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        statusPermissions: { include: { permission: true } },
        moduleAccess: true,
        personas: { include: { persona: true } },
        users: { select: { userId: true } },
      },
    });
  }

  async deleteRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete a system role');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roleModuleAccess.deleteMany({ where: { roleId } });
      await tx.roleStatusPermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePersona.deleteMany({ where: { roleId } });
      await tx.userRole.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    await this.permissionCacheService.refresh();
    return { deleted: true };
  }

  // ── Assign / update roles for existing user ────────────────
  async updateUserRoles(userId: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const uniqueIds = Array.from(new Set(roleIds));
    if (uniqueIds.length > 0) {
      const existing = await this.prisma.role.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (existing.length !== uniqueIds.length) {
        throw new BadRequestException('One or more role IDs are invalid');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (uniqueIds.length > 0) {
        await tx.userRole.createMany({
          data: uniqueIds.map((roleId) => ({ userId, roleId })),
        });
      }
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
  }

  // ── Role-status permission matrix ──────────────────────────
  async getRoleStatusPermissions(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    const entries = await this.prisma.roleStatusPermission.findMany({
      where: { roleId },
      include: { permission: { select: { id: true, key: true } } },
      orderBy: { unitStatus: 'asc' },
    });

    // Group by unitStatus
    const matrix: Record<string, string[]> = {};
    for (const entry of entries) {
      const status = entry.unitStatus;
      if (!matrix[status]) matrix[status] = [];
      matrix[status].push(entry.permission.key);
    }

    return { roleId, roleName: role.name, matrix };
  }

  async setRoleStatusPermissions(
    roleId: string,
    unitStatus: string,
    permissionKeys: string[],
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Role not found');

    const status = unitStatus as UnitStatus;
    const uniqueKeys = Array.from(new Set(permissionKeys));

    const permissions =
      uniqueKeys.length > 0
        ? await this.prisma.permission.findMany({
            where: { key: { in: uniqueKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (permissions.length !== uniqueKeys.length) {
      throw new BadRequestException('One or more permission keys are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roleStatusPermission.deleteMany({
        where: { roleId, unitStatus: status },
      });
      if (permissions.length > 0) {
        await tx.roleStatusPermission.createMany({
          data: permissions.map((perm) => ({
            roleId,
            unitStatus: status,
            permissionId: perm.id,
          })),
        });
      }
    });

    return this.getRoleStatusPermissions(roleId);
  }

  // ── User permission overrides ──────────────────────────────
  async getUserPermissionOverrides(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: { select: { id: true, key: true } } },
    });

    return overrides.map((o) => ({
      id: o.id,
      permissionKey: o.permission.key,
      grant: o.grant,
    }));
  }

  async setUserPermissionOverrides(
    userId: string,
    overrides: Array<{ permissionKey: string; grant: boolean }>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const keys = overrides.map((o) => o.permissionKey);
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

    for (const key of keys) {
      if (!keyToId.has(key)) {
        throw new BadRequestException(`Invalid permission key: ${key}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({ where: { userId } });
      if (overrides.length > 0) {
        await tx.userPermissionOverride.createMany({
          data: overrides.map((o) => ({
            userId,
            permissionId: keyToId.get(o.permissionKey)!,
            grant: o.grant,
          })),
        });
      }
    });

    return this.getUserPermissionOverrides(userId);
  }

  // ── Personas ───────────────────────────────────────────────
  async listPersonas() {
    const rows = await this.prisma.persona.findMany({
      orderBy: [{ isSystem: 'desc' }, { key: 'asc' }],
      include: {
        _count: {
          select: {
            roleLinks: true,
            userOverrides: true,
            visibilityRules: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem,
      isActive: row.isActive,
      roleCount: row._count.roleLinks,
      userOverrideCount: row._count.userOverrides,
      ruleCount: row._count.visibilityRules,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createPersona(input: {
    key: string;
    name: string;
    description?: string;
    isSystem?: boolean;
    isActive?: boolean;
  }) {
    const key = input.key.trim().toUpperCase();
    const name = input.name.trim();
    if (!key) throw new BadRequestException('Persona key is required');
    if (!name) throw new BadRequestException('Persona name is required');

    const existing = await this.prisma.persona.findUnique({ where: { key } });
    if (existing) throw new ConflictException('Persona key already exists');

    return this.prisma.persona.create({
      data: {
        key,
        name,
        description: input.description?.trim() || null,
        isSystem: input.isSystem ?? false,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updatePersona(
    personaId: string,
    input: {
      key?: string;
      name?: string;
      description?: string;
      isSystem?: boolean;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: { id: true, key: true },
    });
    if (!existing) throw new NotFoundException('Persona not found');

    const nextKey = input.key?.trim().toUpperCase();
    if (nextKey && nextKey !== existing.key) {
      const duplicate = await this.prisma.persona.findUnique({
        where: { key: nextKey },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Persona key already exists');
    }

    return this.prisma.persona.update({
      where: { id: personaId },
      data: {
        ...(nextKey ? { key: nextKey } : {}),
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.isSystem !== undefined ? { isSystem: input.isSystem } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async deletePersona(personaId: string) {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        _count: {
          select: {
            roleLinks: true,
            userOverrides: true,
            visibilityRules: true,
          },
        },
      },
    });
    if (!persona) throw new NotFoundException('Persona not found');
    if (persona.isSystem) {
      throw new ForbiddenException('Cannot delete a system persona');
    }

    if (
      persona._count.roleLinks > 0 ||
      persona._count.userOverrides > 0 ||
      persona._count.visibilityRules > 0
    ) {
      throw new BadRequestException(
        'Cannot delete persona while it is linked to roles/users/rules',
      );
    }

    await this.prisma.persona.delete({ where: { id: personaId } });
    return { deleted: true };
  }

  // ── Screens ────────────────────────────────────────────────
  async listScreens(surface?: 'ADMIN_WEB' | 'MOBILE_APP') {
    return this.prisma.screenDefinition.findMany({
      where: surface ? { surface } : undefined,
      orderBy: [{ surface: 'asc' }, { section: 'asc' }, { key: 'asc' }],
      include: {
        _count: {
          select: {
            visibilityRules: true,
          },
        },
      },
    });
  }

  async createScreen(input: {
    key: string;
    title: string;
    section: string;
    description?: string;
    moduleKey?: string;
    surface?: 'ADMIN_WEB' | 'MOBILE_APP';
    isEnabled?: boolean;
  }) {
    const key = input.key.trim().toLowerCase();
    const title = input.title.trim();
    const section = input.section.trim().toLowerCase();
    if (!key) throw new BadRequestException('Screen key is required');
    if (!title) throw new BadRequestException('Screen title is required');
    if (!section) throw new BadRequestException('Screen section is required');

    const existing = await this.prisma.screenDefinition.findUnique({
      where: { key },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Screen key already exists');

    return this.prisma.screenDefinition.create({
      data: {
        key,
        title,
        section,
        description: input.description?.trim() || null,
        moduleKey: input.moduleKey?.trim() || null,
        surface: input.surface ?? 'ADMIN_WEB',
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  async updateScreen(
    screenId: string,
    input: {
      key?: string;
      title?: string;
      section?: string;
      description?: string;
      moduleKey?: string;
      surface?: 'ADMIN_WEB' | 'MOBILE_APP';
      isEnabled?: boolean;
    },
  ) {
    const existing = await this.prisma.screenDefinition.findUnique({
      where: { id: screenId },
      select: { id: true, key: true },
    });
    if (!existing) throw new NotFoundException('Screen not found');

    const nextKey = input.key?.trim().toLowerCase();
    if (nextKey && nextKey !== existing.key) {
      const duplicate = await this.prisma.screenDefinition.findUnique({
        where: { key: nextKey },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Screen key already exists');
    }

    return this.prisma.screenDefinition.update({
      where: { id: screenId },
      data: {
        ...(nextKey ? { key: nextKey } : {}),
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.section ? { section: input.section.trim().toLowerCase() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.moduleKey !== undefined
          ? { moduleKey: input.moduleKey?.trim() || null }
          : {}),
        ...(input.surface ? { surface: input.surface } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      },
    });
  }

  async deleteScreen(screenId: string) {
    const existing = await this.prisma.screenDefinition.findUnique({
      where: { id: screenId },
      include: {
        _count: {
          select: { visibilityRules: true },
        },
      },
    });
    if (!existing) throw new NotFoundException('Screen not found');

    if (existing._count.visibilityRules > 0) {
      throw new BadRequestException(
        'Cannot delete screen while visibility rules still reference it',
      );
    }

    await this.prisma.screenDefinition.delete({ where: { id: screenId } });
    return { deleted: true };
  }

  async listScreenVisibilityRules(surface?: 'ADMIN_WEB' | 'MOBILE_APP') {
    return this.prisma.screenVisibilityRule.findMany({
      where: surface ? { surface } : undefined,
      orderBy: [
        { surface: 'asc' },
        { unitStatus: 'asc' },
        { persona: { key: 'asc' } },
        { screen: { key: 'asc' } },
      ],
      include: {
        persona: { select: { id: true, key: true, name: true } },
        screen: {
          select: {
            id: true,
            key: true,
            title: true,
            section: true,
            surface: true,
          },
        },
      },
    });
  }

  async replaceScreenVisibilityRules(
    rules: Array<{
      personaKey: string;
      screenKey: string;
      surface: 'ADMIN_WEB' | 'MOBILE_APP';
      unitStatus: UnitStatus;
      visible: boolean;
    }>,
  ) {
    const normalizedRules = rules.map((rule) => ({
      personaKey: rule.personaKey.trim().toUpperCase(),
      screenKey: rule.screenKey.trim().toLowerCase(),
      surface: rule.surface,
      unitStatus: rule.unitStatus,
      visible: rule.visible,
    }));

    const uniquePersonaKeys = Array.from(
      new Set(normalizedRules.map((rule) => rule.personaKey)),
    );
    const uniqueScreenKeys = Array.from(
      new Set(normalizedRules.map((rule) => rule.screenKey)),
    );

    const [personas, screens] = await Promise.all([
      this.prisma.persona.findMany({
        where: { key: { in: uniquePersonaKeys } },
        select: { id: true, key: true },
      }),
      this.prisma.screenDefinition.findMany({
        where: { key: { in: uniqueScreenKeys } },
        select: { id: true, key: true, surface: true },
      }),
    ]);

    if (personas.length !== uniquePersonaKeys.length) {
      throw new BadRequestException('One or more persona keys are invalid');
    }
    if (screens.length !== uniqueScreenKeys.length) {
      throw new BadRequestException('One or more screen keys are invalid');
    }

    const personaIdByKey = new Map(personas.map((row) => [row.key, row.id]));
    const screenByKey = new Map(screens.map((row) => [row.key, row]));
    const touchedSurfaces = Array.from(
      new Set(normalizedRules.map((rule) => rule.surface)),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const surface of touchedSurfaces) {
        await tx.screenVisibilityRule.deleteMany({
          where: { surface },
        });
      }

      if (normalizedRules.length > 0) {
        await tx.screenVisibilityRule.createMany({
          data: normalizedRules.map((rule) => {
            const screen = screenByKey.get(rule.screenKey);
            if (!screen) {
              throw new BadRequestException(
                `Invalid screen key: ${rule.screenKey}`,
              );
            }
            if (screen.surface !== rule.surface) {
              throw new BadRequestException(
                `Screen ${rule.screenKey} does not match surface ${rule.surface}`,
              );
            }

            const personaId = personaIdByKey.get(rule.personaKey);
            if (!personaId) {
              throw new BadRequestException(
                `Invalid persona key: ${rule.personaKey}`,
              );
            }

            return {
              personaId,
              screenId: screen.id,
              surface: rule.surface,
              unitStatus: rule.unitStatus,
              visible: rule.visible,
            };
          }),
          skipDuplicates: true,
        });
      }
    });

    return this.listScreenVisibilityRules();
  }

  async setUserPersonaOverride(userId: string, personaKeys: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const uniqueKeys = Array.from(
      new Set(personaKeys.map((key) => key.trim().toUpperCase()).filter(Boolean)),
    );

    const personas =
      uniqueKeys.length > 0
        ? await this.prisma.persona.findMany({
            where: { key: { in: uniqueKeys } },
            select: { id: true, key: true },
          })
        : [];
    if (personas.length !== uniqueKeys.length) {
      throw new BadRequestException('One or more persona keys are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPersonaOverride.deleteMany({
        where: { userId },
      });
      if (personas.length > 0) {
        await tx.userPersonaOverride.createMany({
          data: personas.map((persona) => ({
            userId,
            personaId: persona.id,
            grant: true,
          })),
          skipDuplicates: true,
        });
      }
    });

    return this.prisma.userPersonaOverride.findMany({
      where: { userId },
      include: {
        persona: {
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: { persona: { key: 'asc' } },
    });
  }

  async getUserPersonaOverride(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const rows = await this.prisma.userPersonaOverride.findMany({
      where: { userId, grant: true },
      include: {
        persona: {
          select: { id: true, key: true, name: true },
        },
      },
      orderBy: { persona: { key: 'asc' } },
    });

    return {
      userId,
      personaKeys: rows.map((row) => row.persona.key),
      overrides: rows,
    };
  }

  // ── Permission resolution (base + status + override) ───────
  async resolvePermissions(
    userId: string,
    unitId?: string,
  ): Promise<{ permissions: string[]; modules: string[]; unitStatus?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        permissionOverrides: {
          include: { permission: { select: { key: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const roleNames = user.roles.map((ur) => ur.role.name);

    // 1. Base role permissions
    const basePermissions =
      this.permissionCacheService.resolveUserPermissions(roleNames);

    // 2. Unit-status permissions (if unit context provided)
    let unitStatus: string | undefined;
    const statusPermissions = new Set<string>();

    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { status: true },
      });
      if (unit) {
        unitStatus = unit.status;
        const roleIds = user.roles.map((ur) => ur.roleId);
        if (roleIds.length > 0) {
          const statusPerms =
            await this.prisma.roleStatusPermission.findMany({
              where: {
                roleId: { in: roleIds },
                unitStatus: unit.status,
              },
              include: { permission: { select: { key: true } } },
            });
          for (const sp of statusPerms) {
            statusPermissions.add(sp.permission.key);
          }
        }
      }
    }

    // 3. Merge: base + status permissions
    const merged = new Set([...basePermissions, ...statusPermissions]);

    // 4. Apply user overrides
    for (const override of user.permissionOverrides) {
      if (override.grant) {
        merged.add(override.permission.key);
      } else {
        merged.delete(override.permission.key);
      }
    }

    // 5. Resolve module access
    const moduleAccess = this.permissionCacheService.resolveUserModules(roleNames);

    return {
      permissions: Array.from(merged).sort(),
      modules: Array.from(moduleAccess).sort(),
      unitStatus,
    };
  }

  // ── Seed app page permissions ──────────────────────────────
  async seedAppPagePermissions() {
    const appPageKeys = [
      'app.page.profile',
      'app.page.dashboard',
      'app.page.complaints',
      'app.page.violations',
      'app.page.services',
      'app.page.amenities',
      'app.page.payments',
      'app.page.visitors',
      'app.page.announcements',
      'app.page.directory',
      'app.page.maintenance',
      'app.page.parking',
      'app.page.deliveries',
      'app.page.emergency',
    ];

    let created = 0;
    for (const key of appPageKeys) {
      const existing = await this.prisma.permission.findUnique({
        where: { key },
      });
      if (!existing) {
        await this.prisma.permission.create({ data: { key } });
        created++;
      }
    }

    await this.permissionCacheService.refresh();
    return { seeded: created, total: appPageKeys.length };
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
          data: { status: UnitStatus.OFF_PLAN },
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

  // ===== USERS HUB =====

  async listOwners(
    filters: ListOwnersQueryDto,
  ): Promise<PaginatedResponseDto<OwnerListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const searchFilter = this.buildUserSearchWhere(filters.search);
    const communityFilter = filters.communityId
      ? {
          OR: [
            {
              resident: {
                residentUnits: {
                  some: {
                    unit: {
                      communityId: filters.communityId,
                    },
                  },
                },
              },
            },
            {
              ownerUnitContracts: {
                some: {
                  unit: {
                    communityId: filters.communityId,
                  },
                },
              },
            },
          ],
        }
      : {};

    const where: Prisma.OwnerWhereInput = {
      user: {
        ...(filters.status ? { userStatus: filters.status } : {}),
        ...(searchFilter ?? {}),
        ...communityFilter,
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.owner.count({ where }),
      this.prisma.owner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { user: { createdAt: 'desc' } },
        include: {
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
              userStatus: true,
              resident: {
                select: {
                  id: true,
                  residentUnits: {
                    select: {
                      isPrimary: true,
                      unit: {
                        select: {
                          id: true,
                          unitNumber: true,
                        },
                      },
                    },
                  },
                },
              },
              ownerUnitContracts: {
                where: {
                  archivedAt: null,
                  ...(filters.communityId
                    ? {
                        unit: { communityId: filters.communityId },
                      }
                    : {}),
                },
                select: {
                  unit: {
                    select: {
                      id: true,
                      unitNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const ownerUserIds = rows.map((row) => row.user.id);
    const residentIds = rows
      .map((row) => row.user.resident?.id)
      .filter((value): value is string => typeof value === 'string');

    const [familyCounts, staffCounts] = await Promise.all([
      residentIds.length > 0
        ? this.prisma.familyMember.groupBy({
            by: ['primaryResidentId'],
            where: {
              primaryResidentId: { in: residentIds },
              status: UserStatusEnum.ACTIVE,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ownerUserIds.length > 0
        ? this.prisma.homeStaffAccess.groupBy({
            by: ['ownerUserId'],
            where: {
              ownerUserId: { in: ownerUserIds },
              status: HouseholdRequestStatus.APPROVED,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const familyCountByResidentId = new Map<string, number>(
      familyCounts.map(
        (entry): [string, number] => [entry.primaryResidentId, entry._count._all],
      ),
    );
    const staffCountByOwnerUserId = new Map<string, number>(
      staffCounts.map(
        (entry): [string, number] => [entry.ownerUserId, entry._count._all],
      ),
    );

    const items: OwnerListItemDto[] = rows.map((row) => {
      const unitMap = new Map<string, UnitItemDto>();
      row.user.resident?.residentUnits.forEach((residentUnit) => {
        unitMap.set(residentUnit.unit.id, {
          id: residentUnit.unit.id,
          unitNumber: residentUnit.unit.unitNumber,
        });
      });
      row.user.ownerUnitContracts.forEach((contract) => {
        unitMap.set(contract.unit.id, {
          id: contract.unit.id,
          unitNumber: contract.unit.unitNumber,
        });
      });

      const familyCount = row.user.resident
        ? (familyCountByResidentId.get(row.user.resident.id) ?? 0)
        : 0;

      return {
        userId: row.user.id,
        name: this.resolveUserName(row.user),
        email: row.user.email,
        phone: row.user.phone,
        status: row.user.userStatus,
        unitsCount: unitMap.size,
        unitNumbers: Array.from(unitMap.values()).map((unit) => unit.unitNumber),
        familyMembersCount: familyCount,
        homeStaffCount: staffCountByOwnerUserId.get(row.user.id) ?? 0,
      };
    });

    return new PaginatedResponseDto<OwnerListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async listFamilyMembers(
    filters: ListFamilyMembersQueryDto,
  ): Promise<PaginatedResponseDto<FamilyMemberListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const searchFilter = this.buildUserSearchWhere(filters.search);

    const where: Prisma.FamilyMemberWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerUserId
        ? { primaryResident: { userId: filters.ownerUserId } }
        : {}),
      ...(filters.unitId
        ? {
            primaryResident: {
              residentUnits: {
                some: {
                  unitId: filters.unitId,
                },
              },
            },
          }
        : {}),
      ...(searchFilter
        ? {
            familyResident: {
              user: searchFilter,
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.familyMember.count({ where }),
      this.prisma.familyMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          primaryResident: {
            include: {
              user: {
                select: {
                  id: true,
                  nameEN: true,
                  nameAR: true,
                  email: true,
                  phone: true,
                },
              },
              residentUnits: {
                where: filters.unitId ? { unitId: filters.unitId } : undefined,
                include: {
                  unit: {
                    select: {
                      id: true,
                      unitNumber: true,
                    },
                  },
                },
              },
            },
          },
          familyResident: {
            include: {
              user: {
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
      }),
    ]);

    const items: FamilyMemberListItemDto[] = rows.map((row) => {
      const unit =
        row.primaryResident.residentUnits.find((entry) => entry.isPrimary)
          ?.unit ?? row.primaryResident.residentUnits[0]?.unit;

      return {
        userId: row.familyResident.user.id,
        name: this.resolveUserName(row.familyResident.user),
        email: row.familyResident.user.email,
        phone: row.familyResident.user.phone,
        status: row.status,
        primaryOwnerName: this.resolveUserName(row.primaryResident.user),
        unitNumber: unit?.unitNumber ?? null,
        relationshipType: row.relationship,
        activatedAt: row.activatedAt.toISOString(),
      };
    });

    return new PaginatedResponseDto<FamilyMemberListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async listTenants(
    filters: ListTenantsQueryDto,
  ): Promise<PaginatedResponseDto<TenantListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const searchFilter = this.buildUserSearchWhere(filters.search);
    const leaseWhere: Prisma.LeaseWhereInput = {
      ...(filters.communityId
        ? {
            unit: { communityId: filters.communityId },
          }
        : {}),
      ...(filters.leaseStatus ? { status: filters.leaseStatus } : {}),
    };
    const shouldFilterByLease =
      Boolean(filters.communityId) || Boolean(filters.leaseStatus);

    const where: Prisma.TenantWhereInput = {
      user: {
        ...(filters.status ? { userStatus: filters.status } : {}),
        ...(searchFilter ?? {}),
        ...(shouldFilterByLease
          ? {
              leasesAsTenant: {
                some: leaseWhere,
              },
            }
          : {}),
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { user: { createdAt: 'desc' } },
        include: {
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
              userStatus: true,
              leasesAsTenant: {
                where: leaseWhere,
                orderBy: [{ endDate: 'desc' }],
                take: 1,
                include: {
                  unit: {
                    select: {
                      id: true,
                      unitNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: TenantListItemDto[] = rows.map((row) => {
      const lease = row.user.leasesAsTenant[0] ?? null;
      return {
        userId: row.user.id,
        name: this.resolveUserName(row.user),
        email: row.user.email,
        phone: row.user.phone,
        status: row.user.userStatus,
        unitNumber: lease?.unit.unitNumber ?? null,
        leaseStart: lease ? lease.startDate.toISOString() : null,
        leaseEnd: lease ? lease.endDate.toISOString() : null,
        monthlyRent: lease ? this.decimalToNumber(lease.monthlyRent) : null,
        leaseStatus: lease?.status ?? null,
      };
    });

    return new PaginatedResponseDto<TenantListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async listHomeStaff(
    filters: ListHomeStaffQueryDto,
  ): Promise<PaginatedResponseDto<HomeStaffListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const search = this.normalizeSearch(filters.search);

    const where: Prisma.HomeStaffAccessWhereInput = {
      ...(filters.staffType ? { staffType: filters.staffType } : {}),
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      status: filters.status ?? HouseholdRequestStatus.APPROVED,
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                owner: {
                  OR: [
                    {
                      nameEN: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      nameAR: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      email: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      phone: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.homeStaffAccess.count({ where }),
      this.prisma.homeStaffAccess.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
            },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
            },
          },
        },
      }),
    ]);

    const items: HomeStaffListItemDto[] = rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      staffType: row.staffType,
      phone: row.phone,
      ownerName: this.resolveUserName(row.owner),
      unitNumber: row.unit?.unitNumber ?? null,
      employmentFrom: this.toIsoString(row.employmentFrom),
      employmentTo: this.toIsoString(row.employmentTo),
      isLiveIn: row.isLiveIn,
      accessValidFrom: row.accessValidFrom.toISOString(),
      accessValidTo: row.accessValidTo.toISOString(),
      status: row.status,
    }));

    return new PaginatedResponseDto<HomeStaffListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async listDelegates(
    filters: ListDelegatesQueryDto,
  ): Promise<PaginatedResponseDto<DelegateListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const search = this.normalizeSearch(filters.search);

    const where: Prisma.AuthorizedAccessRequestWhereInput = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      status: filters.status ?? HouseholdRequestStatus.APPROVED,
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                owner: {
                  OR: [
                    {
                      nameEN: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      nameAR: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      email: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      phone: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.authorizedAccessRequest.count({ where }),
      this.prisma.authorizedAccessRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
            },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
            },
          },
        },
      }),
    ]);

    const activatedUserIds = rows
      .map((row) => row.activatedUserId)
      .filter((value): value is string => typeof value === 'string');
    const unitIds = Array.from(new Set(rows.map((row) => row.unitId)));

    const delegateAccessRows =
      activatedUserIds.length > 0
        ? await this.prisma.unitAccess.findMany({
            where: {
              userId: { in: activatedUserIds },
              unitId: { in: unitIds },
              role: UnitAccessRole.DELEGATE,
              status: AccessStatus.ACTIVE,
            },
            select: {
              userId: true,
              unitId: true,
              delegateType: true,
            },
          })
        : [];

    const delegateTypeByUserAndUnit = new Map<string, DelegateType | null>(
      delegateAccessRows.map((row) => [
        `${row.userId}:${row.unitId}`,
        row.delegateType ?? null,
      ]),
    );

    const items: DelegateListItemDto[] = rows.map((row) => {
      const key = row.activatedUserId
        ? `${row.activatedUserId}:${row.unitId}`
        : null;
      const delegateType = key
        ? delegateTypeByUserAndUnit.get(key) ?? null
        : null;

      return {
        id: row.id,
        fullName: row.fullName,
        phone: row.phone,
        ownerName: this.resolveUserName(row.owner),
        unitNumber: row.unit?.unitNumber ?? null,
        delegateType: delegateType ?? 'AUTHORIZED',
        validFrom: row.validFrom.toISOString(),
        validTo: row.validTo.toISOString(),
        qrScopes: row.qrScopes,
        feeMode: row.feeMode,
      };
    });

    return new PaginatedResponseDto<DelegateListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async listBrokers(
    filters: ListBrokersQueryDto,
  ): Promise<PaginatedResponseDto<BrokerResponseDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const searchFilter = this.buildUserSearchWhere(filters.search);

    const where: Prisma.BrokerWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(searchFilter ? { user: searchFilter } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.broker.count({ where }),
      this.prisma.broker.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return new PaginatedResponseDto<BrokerResponseDto>({
      items: rows.map((row) => this.mapBrokerResponse(row)),
      page,
      limit,
      total,
    });
  }

  async listCompoundStaff(query: ListCompoundStaffDto) {
    return this.compoundStaffService.list(query);
  }

  async listSystemUsers(
    filters: ListSystemUsersQueryDto,
  ): Promise<PaginatedResponseDto<SystemUserListItemDto>> {
    const { page, limit, skip } = this.normalizePagination(
      filters.page,
      filters.limit,
    );
    const searchFilter = this.buildUserSearchWhere(filters.search);

    const where: Prisma.UserWhereInput = {
      ...(filters.status ? { userStatus: filters.status } : {}),
      ...(searchFilter ?? {}),
      ...(filters.roleId
        ? {
            roles: {
              some: {
                roleId: filters.roleId,
              },
            },
          }
        : {}),
      OR: filters.roleId
        ? [
            {
              roles: {
                some: {
                  roleId: filters.roleId,
                },
              },
            },
          ]
        : [{ admin: { isNot: null } }, this.systemRolePredicate()],
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nameEN: true,
          nameAR: true,
          email: true,
          phone: true,
          userStatus: true,
          lastLoginAt: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items: SystemUserListItemDto[] = rows.map((row) => ({
      userId: row.id,
      name: this.resolveUserName(row),
      email: row.email,
      roles: row.roles.map((item) => item.role.name),
      status: row.userStatus,
      lastLoginAt: this.toIsoString(row.lastLoginAt),
    }));

    return new PaginatedResponseDto<SystemUserListItemDto>({
      items,
      page,
      limit,
      total,
    });
  }

  async getUserDetail(userId: string): Promise<UserDetailResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        owner: true,
        tenant: true,
        admin: true,
        broker: true,
        profilePhoto: {
          select: {
            id: true,
            key: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        resident: {
          include: {
            residentUnits: {
              include: {
                unit: {
                  select: {
                    id: true,
                    unitNumber: true,
                  },
                },
              },
            },
            familyOf: {
              include: {
                primaryResident: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        nameEN: true,
                        nameAR: true,
                        email: true,
                        phone: true,
                      },
                    },
                    residentUnits: {
                      include: {
                        unit: {
                          select: {
                            id: true,
                            unitNumber: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        leasesAsTenant: {
          orderBy: { endDate: 'desc' },
          take: 1,
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
        },
        leasesAsOwner: {
          orderBy: { endDate: 'desc' },
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
        },
        ownerUnitContracts: {
          where: { archivedAt: null },
          include: {
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
        },
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        compoundStaffAssignments: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            profession: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const [delegateRecord, homeStaffRecord, complaintsCount, violationsCount] =
      await Promise.all([
        this.prisma.authorizedAccessRequest.findFirst({
          where: {
            activatedUserId: userId,
            status: HouseholdRequestStatus.APPROVED,
          },
          include: {
            owner: {
              select: {
                id: true,
                nameEN: true,
                nameAR: true,
                email: true,
                phone: true,
              },
            },
            unit: {
              select: {
                id: true,
                unitNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        user.phone
          ? this.prisma.homeStaffAccess.findFirst({
              where: {
                phone: user.phone,
                status: HouseholdRequestStatus.APPROVED,
              },
              include: {
                owner: {
                  select: {
                    id: true,
                    nameEN: true,
                    nameAR: true,
                    email: true,
                    phone: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    unitNumber: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve(null),
        this.prisma.complaint.count({
          where: {
            OR: [{ reporterId: userId }, { assignedToId: userId }],
          },
        }),
        this.prisma.violation.count({
          where: {
            OR: [{ residentId: userId }, { issuedById: userId }],
          },
        }),
      ]);

    const tenantLease = user.leasesAsTenant[0] ?? null;
    const familyLink = user.resident?.familyOf ?? null;
    const ownerUnits = this.collectOwnerUnits(user);
    const familyCount = user.resident
      ? await this.prisma.familyMember.count({
          where: {
            primaryResidentId: user.resident.id,
          },
        })
      : 0;
    const staffCount = user.owner
      ? await this.prisma.homeStaffAccess.count({
          where: {
            ownerUserId: user.id,
            status: HouseholdRequestStatus.APPROVED,
          },
        })
      : 0;
    const hasSystemRole = user.roles.some((roleRow) =>
      this.isSystemRoleName(roleRow.role.name),
    );

    let userType: UserTypeValue = 'SYSTEM_USER';
    if (user.owner) {
      userType = 'OWNER';
    } else if (user.tenant) {
      userType = 'TENANT';
    } else if (familyLink) {
      userType = 'FAMILY';
    } else if (delegateRecord) {
      userType = 'DELEGATE';
    } else if (homeStaffRecord) {
      userType = 'HOME_STAFF';
    } else if (user.broker) {
      userType = 'BROKER';
    } else if (user.admin || hasSystemRole) {
      userType = 'SYSTEM_USER';
    } else if (user.compoundStaffAssignments.length > 0) {
      userType = 'COMPOUND_STAFF';
    }

    const unitsMap = new Map<string, UnitItemDto>();
    ownerUnits.forEach((unit) => unitsMap.set(unit.id, unit));
    user.resident?.residentUnits.forEach((residentUnit) => {
      unitsMap.set(residentUnit.unit.id, {
        id: residentUnit.unit.id,
        unitNumber: residentUnit.unit.unitNumber,
      });
    });
    user.leasesAsOwner.forEach((lease) => {
      unitsMap.set(lease.unit.id, {
        id: lease.unit.id,
        unitNumber: lease.unit.unitNumber,
      });
    });
    if (tenantLease) {
      unitsMap.set(tenantLease.unit.id, {
        id: tenantLease.unit.id,
        unitNumber: tenantLease.unit.unitNumber,
      });
    }

    const linkedLeases: LeaseItemDto[] = [
      ...user.leasesAsOwner.map((lease) => ({
        id: lease.id,
        unitId: lease.unitId,
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate.toISOString(),
        monthlyRent: this.decimalToNumber(lease.monthlyRent),
        status: lease.status,
      })),
      ...user.leasesAsTenant.map((lease) => ({
        id: lease.id,
        unitId: lease.unitId,
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate.toISOString(),
        monthlyRent: this.decimalToNumber(lease.monthlyRent),
        status: lease.status,
      })),
    ];

    return {
      id: user.id,
      name: this.resolveUserName(user),
      email: user.email,
      phone: user.phone,
      status: user.userStatus,
      userType,
      profilePhotoUrl: user.profilePhoto?.key ?? null,
      lastLoginAt: this.toIsoString(user.lastLoginAt),
      createdAt: user.createdAt.toISOString(),
      ownerData: user.owner
        ? {
            units: ownerUnits,
            familyCount,
            staffCount,
          }
        : undefined,
      tenantData: tenantLease
        ? {
            lease: {
              id: tenantLease.id,
              unitId: tenantLease.unitId,
              startDate: tenantLease.startDate.toISOString(),
              endDate: tenantLease.endDate.toISOString(),
              monthlyRent: this.decimalToNumber(tenantLease.monthlyRent),
              status: tenantLease.status,
            },
            unit: {
              id: tenantLease.unit.id,
              unitNumber: tenantLease.unit.unitNumber,
            },
          }
        : undefined,
      familyData: familyLink
        ? {
            primaryOwner: this.mapUserItem(familyLink.primaryResident.user),
            unit: this.pickPrimaryUnit(familyLink.primaryResident.residentUnits),
            relationship: familyLink.relationship,
          }
        : undefined,
      delegateData: delegateRecord
        ? {
            owner: this.mapUserItem(delegateRecord.owner),
            unit: {
              id: delegateRecord.unit.id,
              unitNumber: delegateRecord.unit.unitNumber,
            },
            permissions: delegateRecord.qrScopes,
          }
        : undefined,
      homeStaffData: homeStaffRecord
        ? {
            owner: this.mapUserItem(homeStaffRecord.owner),
            unit: {
              id: homeStaffRecord.unit.id,
              unitNumber: homeStaffRecord.unit.unitNumber,
            },
            staffType: homeStaffRecord.staffType,
          }
        : undefined,
      brokerData: user.broker
        ? {
            agencyName: user.broker.agencyName,
            licenseNumber: user.broker.licenseNumber,
          }
        : undefined,
      activity: user.statusLogs.map((log) => ({
        id: log.id,
        newStatus: log.newStatus,
        note: log.note,
        createdAt: log.createdAt.toISOString(),
      })),
      linkedRecords: {
        units: Array.from(unitsMap.values()),
        leases: linkedLeases,
        complaints: complaintsCount,
        violations: violationsCount,
      },
    };
  }

  async suspendUser(
    userId: string,
    reason: string,
  ): Promise<{ success: true; userId: string; status: UserStatusEnum }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { userStatus: UserStatusEnum.SUSPENDED },
      });
      await tx.userStatusLog.create({
        data: {
          userId,
          newStatus: UserStatusEnum.SUSPENDED,
          source: UserStatusLogSource.ADMIN,
          note: reason,
        },
      });
    });

    return { success: true, userId, status: UserStatusEnum.SUSPENDED };
  }

  async activateUser(
    userId: string,
    note?: string,
  ): Promise<{ success: true; userId: string; status: UserStatusEnum }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { userStatus: UserStatusEnum.ACTIVE },
      });
      await tx.userStatusLog.create({
        data: {
          userId,
          newStatus: UserStatusEnum.ACTIVE,
          source: UserStatusLogSource.ADMIN,
          note: note?.trim() || 'Activated by admin',
        },
      });
    });

    return { success: true, userId, status: UserStatusEnum.ACTIVE };
  }

  async getAllUserStats(): Promise<UserStatsResponseDto> {
    const systemUserWhere: Prisma.UserWhereInput = {
      OR: [{ admin: { isNot: null } }, this.systemRolePredicate()],
    };

    const [
      totalUsers,
      totalOwners,
      totalFamilyMembers,
      totalTenants,
      totalHomeStaff,
      totalDelegates,
      totalBrokers,
      totalSystemUsers,
      pendingFamilyApprovals,
      pendingDelegateApprovals,
      pendingHomeStaffApprovals,
      suspendedUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.owner.count(),
      this.prisma.familyMember.count(),
      this.prisma.tenant.count(),
      this.prisma.homeStaffAccess.count({
        where: { status: HouseholdRequestStatus.APPROVED },
      }),
      this.prisma.authorizedAccessRequest.count({
        where: { status: HouseholdRequestStatus.APPROVED },
      }),
      this.prisma.broker.count(),
      this.prisma.user.count({
        where: systemUserWhere,
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
      this.prisma.user.count({
        where: { userStatus: UserStatusEnum.SUSPENDED },
      }),
    ]);

    return {
      totalUsers,
      totalOwners,
      totalFamilyMembers,
      totalTenants,
      totalHomeStaff,
      totalDelegates,
      totalBrokers,
      totalSystemUsers,
      pendingApprovals:
        pendingFamilyApprovals +
        pendingDelegateApprovals +
        pendingHomeStaffApprovals,
      suspendedUsers,
    };
  }

  async createBroker(dto: CreateBrokerDto): Promise<BrokerResponseDto> {
    const createdBroker = await this.prisma.$transaction(async (tx) => {
      let userId = dto.userId;
      if (userId) {
        const existingUser = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!existingUser) {
          throw new NotFoundException('User not found');
        }

        if (dto.name || dto.email || dto.phone) {
          await tx.user.update({
            where: { id: userId },
            data: {
              ...(dto.name !== undefined ? { nameEN: dto.name.trim() } : {}),
              ...(dto.email !== undefined
                ? { email: dto.email.trim().toLowerCase() }
                : {}),
              ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
            },
          });
        }
      } else {
        if (!dto.name) {
          throw new BadRequestException('name is required when userId is not provided');
        }
        const createdUser = await tx.user.create({
          data: {
            nameEN: dto.name.trim(),
            email: dto.email?.trim().toLowerCase() ?? null,
            phone: dto.phone?.trim() ?? null,
            userStatus: UserStatusEnum.ACTIVE,
            signupSource: 'dashboard',
          },
          select: { id: true },
        });
        userId = createdUser.id;
      }

      const existingBroker = await tx.broker.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (existingBroker) {
        throw new ConflictException('Broker already exists for this user');
      }

      return tx.broker.create({
        data: {
          userId,
          agencyName: dto.agencyName?.trim() || null,
          licenseNumber: dto.licenseNumber?.trim() || null,
          status: UserStatusEnum.ACTIVE,
        },
        include: {
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    });

    return this.mapBrokerResponse(createdBroker);
  }

  async updateBroker(
    brokerId: string,
    dto: UpdateBrokerDto,
  ): Promise<BrokerResponseDto> {
    const existing = await this.prisma.broker.findUnique({
      where: { id: brokerId },
      include: {
        user: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Broker not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        dto.name !== undefined ||
        dto.email !== undefined ||
        dto.phone !== undefined
      ) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(dto.name !== undefined ? { nameEN: dto.name.trim() } : {}),
            ...(dto.email !== undefined
              ? { email: dto.email?.trim().toLowerCase() || null }
              : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
          },
        });
      }

      return tx.broker.update({
        where: { id: brokerId },
        data: {
          ...(dto.agencyName !== undefined
            ? { agencyName: dto.agencyName?.trim() || null }
            : {}),
          ...(dto.licenseNumber !== undefined
            ? { licenseNumber: dto.licenseNumber?.trim() || null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    });

    return this.mapBrokerResponse(updated);
  }

  private normalizePagination(page?: number, limit?: number) {
    const safePage = Math.max(1, page ?? 1);
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private normalizeSearch(value?: string): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  private buildUserSearchWhere(
    search?: string,
  ): Prisma.UserWhereInput | undefined {
    const query = this.normalizeSearch(search);
    if (!query) {
      return undefined;
    }

    return {
      OR: [
        {
          nameEN: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          nameAR: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          phone: {
            contains: query,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  private resolveUserName(input: {
    id: string;
    nameEN: string | null;
    nameAR: string | null;
    email: string | null;
    phone: string | null;
  }): string {
    const name = input.nameEN?.trim() || input.nameAR?.trim();
    if (name) {
      return name;
    }
    if (input.email?.trim()) {
      return input.email.trim();
    }
    if (input.phone?.trim()) {
      return input.phone.trim();
    }
    return input.id;
  }

  private decimalToNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return value.toNumber();
  }

  private toIsoString(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }

  private mapUserItem(input: {
    id: string;
    nameEN: string | null;
    nameAR: string | null;
    email: string | null;
    phone: string | null;
  }): UserItemDto {
    return {
      id: input.id,
      name: this.resolveUserName(input),
      email: input.email,
      phone: input.phone,
    };
  }

  private pickPrimaryUnit(
    residentUnits: Array<{
      isPrimary: boolean;
      unit: { id: string; unitNumber: string };
    }>,
  ): UnitItemDto | null {
    const unit =
      residentUnits.find((entry) => entry.isPrimary)?.unit ??
      residentUnits[0]?.unit;
    if (!unit) {
      return null;
    }

    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
    };
  }

  private collectOwnerUnits(input: {
    resident: {
      residentUnits: Array<{
        unit: { id: string; unitNumber: string };
      }>;
    } | null;
    ownerUnitContracts: Array<{
      unit: { id: string; unitNumber: string };
    }>;
  }): UnitItemDto[] {
    const units = new Map<string, UnitItemDto>();
    input.resident?.residentUnits.forEach((residentUnit) => {
      units.set(residentUnit.unit.id, {
        id: residentUnit.unit.id,
        unitNumber: residentUnit.unit.unitNumber,
      });
    });
    input.ownerUnitContracts.forEach((contract) => {
      units.set(contract.unit.id, {
        id: contract.unit.id,
        unitNumber: contract.unit.unitNumber,
      });
    });
    return Array.from(units.values());
  }

  private systemRolePredicate(): Prisma.UserWhereInput {
    return {
      roles: {
        some: {
          role: {
            OR: [
              {
                name: {
                  contains: 'admin',
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                name: {
                  contains: 'system',
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                permissions: {
                  some: {
                    permission: {
                      key: {
                        startsWith: 'admin.',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  private isSystemRoleName(roleName: string): boolean {
    const value = roleName.toLowerCase();
    return value.includes('admin') || value.includes('system');
  }

  private mapBrokerResponse(input: {
    id: string;
    userId: string;
    agencyName: string | null;
    licenseNumber: string | null;
    status: UserStatusEnum;
    createdAt: Date;
    user: {
      id: string;
      nameEN: string | null;
      nameAR: string | null;
      email: string | null;
      phone: string | null;
    };
  }): BrokerResponseDto {
    return {
      id: input.id,
      userId: input.userId,
      name: this.resolveUserName(input.user),
      email: input.user.email,
      phone: input.user.phone,
      agencyName: input.agencyName,
      licenseNumber: input.licenseNumber,
      status: input.status,
      createdAt: input.createdAt.toISOString(),
    };
  }
}
