import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, UserStatusEnum } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
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
    resident: true;
    owner: true;
    tenant: true;
    admin: true;
    residentUnits: { include: { unit: true } };
    leasesAsOwner: true;
    leasesAsTenant: true;
    invoices: true;
  };
}>;

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
export class ResidentService {
  constructor(private prisma: PrismaService) {}

  // ===== USER MANAGEMENT =====

  /**
   * Create a new user (base user without profile type)
   */
  async createUser(data: CreateUserDto): Promise<UserWithRelations> {
    const { password, roles: roleIds, ...restOfData } = data;

    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await this.prisma.user.create({
      data: {
        ...restOfData,
        passwordHash,
        userStatus: UserStatusEnum.ACTIVE,
        signupSource: data.signupSource || 'dashboard',
      },
      include: {
        roles: { include: { role: true } },
        resident: true,
        owner: true,
        tenant: true,
        admin: true,
        residentUnits: { include: { unit: true } },
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });

    // Assign roles if provided
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId,
          },
        });
      }

      // Re-fetch user with updated roles
      return this.getUserWithRelations(user.id);
    }

    return user;
  }

  /**
   * Get all users with optional filtering
   */
  async findAllUsers(
    userType?: 'resident' | 'owner' | 'tenant' | 'admin',
    skip: number = 0,
    take: number = 20,
  ): Promise<UserWithRelations[]> {
    const where: Prisma.UserWhereInput = {
      userStatus: { in: [UserStatusEnum.ACTIVE, UserStatusEnum.SUSPENDED, UserStatusEnum.INVITED] },
    };

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
        resident: true,
        owner: true,
        tenant: true,
        admin: true,
        residentUnits: { include: { unit: true } },
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
        resident: true,
        owner: true,
        tenant: true,
        admin: true,
        residentUnits: { include: { unit: true } },
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
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }

    // Verify user exists
    await this.getUserWithRelations(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        roles: { include: { role: true } },
        resident: true,
        owner: true,
        tenant: true,
        admin: true,
        residentUnits: { include: { unit: true } },
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
        resident: true,
        owner: true,
        tenant: true,
        admin: true,
        residentUnits: { include: { unit: true } },
        leasesAsOwner: true,
        leasesAsTenant: true,
        invoices: true,
      },
    });
  }

  // ===== RESIDENT MANAGEMENT =====

  /**
   * Create a resident profile for an existing user
   */
  async createResident(data: CreateResidentDto): Promise<ResidentWithUser> {
    // Verify user exists
    await this.getUserWithRelations(data.userId);

    // Check if resident already exists
    const existing = await this.prisma.resident.findUnique({
      where: { userId: data.userId },
    });

    if (existing) {
      throw new ConflictException(
        `Resident profile already exists for user ${data.userId}`,
      );
    }

    return this.prisma.resident.create({
      data,
      include: { user: true },
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
   * Delete a resident profile
   */
  async deleteResident(id: string): Promise<ResidentWithUser> {
    await this.getResident(id);

    return this.prisma.resident.delete({
      where: { id },
      include: { user: true },
    });
  }

  // ===== OWNER MANAGEMENT =====

  /**
   * Create an owner profile for an existing user
   */
  async createOwner(data: CreateOwnerDto): Promise<OwnerWithUser> {
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
  async createTenant(data: CreateTenantDto): Promise<TenantWithUser> {
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
  async createAdmin(data: CreateAdminDto): Promise<AdminWithUser> {
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
        status: data.status ? (data.status as UserStatusEnum) : UserStatusEnum.ACTIVE,
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
