import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';

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
import { CreateDashboardUserDto } from './dto/create-dashboard-user.dto';
import { UpsertDashboardRoleDto } from './dto/upsert-dashboard-role.dto';

import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  // ============================================
  //                 USERS
  // ============================================
  @Post()
  @Permissions('user.create')
  createUser(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.createUser(dto, {
      actorUserId: req.user.id,
      permissions: req.user.permissions,
    });
  }

  @Get()
  @ApiQuery({
    name: 'userType',
    enum: ['resident', 'owner', 'tenant', 'admin'],
    required: false,
  })
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('user.read')
  findAllUsers(
    @Query('userType') userType?: 'resident' | 'owner' | 'tenant' | 'admin',
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.usersService.findAllUsers(
      userType,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('dashboard')
  @Permissions('admin.view')
  listDashboardUsers(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.usersService.findDashboardUsers(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 100,
    );
  }

  @Post('dashboard')
  @Permissions('admin.create')
  createDashboardUser(@Body() dto: CreateDashboardUserDto, @Request() req) {
    return this.usersService.createDashboardUser(dto, {
      actorUserId: req.user.id,
      permissions: req.user.permissions,
    });
  }

  @Get('roles')
  @Permissions('admin.view')
  listRoles() {
    return this.usersService.listRolesWithPermissions();
  }

  @Post('roles')
  @Permissions('admin.update')
  createRole(@Body() dto: UpsertDashboardRoleDto) {
    return this.usersService.createRoleWithPermissions(dto);
  }

  @Patch('roles/:roleId')
  @Permissions('admin.update')
  updateRole(@Param('roleId') roleId: string, @Body() dto: UpsertDashboardRoleDto) {
    return this.usersService.updateRoleWithPermissions(roleId, dto);
  }

  @Get('permissions')
  @Permissions('admin.view')
  listPermissions() {
    return this.usersService.listPermissions();
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @Permissions('user.read')
  getUser(@Param('id') id: string) {
    return this.usersService.getUserWithRelations(id);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @Permissions('user.update')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('user.delete')
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Delete(':id([0-9a-fA-F-]{36})/hard')
  @Permissions('user.delete')
  hardDeleteUser(
    @Param('id') id: string,
    @Query('purge') purge?: string,
  ) {
    const shouldPurge =
      purge === undefined ? true : ['1', 'true', 'yes'].includes(String(purge).toLowerCase());
    return this.usersService.hardDeleteUser(id, shouldPurge);
  }

  // ============================================
  //                RESIDENTS
  // ============================================

  @Post('residents')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('resident.create')
  createResident(@Body() dto: CreateResidentDto, @Request() req) {
    return this.usersService.createResident(dto, {
      permissions: req.user.permissions,
    });
  }

  @Get('residents')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('resident.view')
  findAllResidents(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findAllResidents(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('residents/:id')
  @Permissions('resident.view')
  getResident(@Param('id') id: string) {
    return this.usersService.getResident(id);
  }

  @Patch('residents/:id')
  @Permissions('resident.update')
  updateResident(@Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.usersService.updateResident(id, dto);
  }

  @Delete('residents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('resident.delete')
  deleteResident(@Param('id') id: string) {
    return this.usersService.deleteResident(id);
  }

  // ============================================
  //                 OWNERS
  // ============================================

  @Post('owners')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('owner.create')
  createOwner(@Body() dto: CreateOwnerDto, @Request() req) {
    return this.usersService.createOwner(dto, {
      permissions: req.user.permissions,
    });
  }

  @Get('owners')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('owner.view')
  findAllOwners(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findAllOwners(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('owners/:id')
  @Permissions('owner.view')
  getOwner(@Param('id') id: string) {
    return this.usersService.getOwner(id);
  }

  @Patch('owners/:id')
  @Permissions('owner.update')
  updateOwner(@Param('id') id: string, @Body() dto: UpdateOwnerDto) {
    return this.usersService.updateOwner(id, dto);
  }

  @Delete('owners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('owner.delete')
  deleteOwner(@Param('id') id: string) {
    return this.usersService.deleteOwner(id);
  }

  // ============================================
  //                 TENANTS
  // ============================================

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('tenant.create')
  createTenant(@Body() dto: CreateTenantDto, @Request() req) {
    return this.usersService.createTenant(dto, {
      permissions: req.user.permissions,
    });
  }

  @Get('tenants')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('tenant.view')
  findAllTenants(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findAllTenants(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('tenants/:id')
  @Permissions('tenant.view')
  getTenant(@Param('id') id: string) {
    return this.usersService.getTenant(id);
  }

  @Patch('tenants/:id')
  @Permissions('tenant.update')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.usersService.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('tenant.delete')
  deleteTenant(@Param('id') id: string) {
    return this.usersService.deleteTenant(id);
  }

  // ============================================
  //                 ADMINS
  // ============================================

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('admin.create')
  createAdmin(@Body() dto: CreateAdminDto, @Request() req) {
    return this.usersService.createAdmin(dto, {
      permissions: req.user.permissions,
    });
  }

  @Get('admins')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('admin.view')
  findAllAdmins(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.findAllAdmins(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('admins/:id')
  @Permissions('admin.view')
  getAdmin(@Param('id') id: string) {
    return this.usersService.getAdmin(id);
  }

  @Patch('admins/:id')
  @Permissions('admin.update')
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.usersService.updateAdmin(id, dto);
  }

  @Delete('admins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('admin.delete')
  deleteAdmin(@Param('id') id: string) {
    return this.usersService.deleteAdmin(id);
  }
}
