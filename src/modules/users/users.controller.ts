import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
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
import { UpdateResidentProfileAdminDto } from './dto/update-resident-profile-admin.dto';
import { AssignResidentUnitDto } from './dto/assign-resident-unit.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { SetRoleStatusPermissionsDto } from './dto/set-role-status-permissions.dto';
import { SetUserOverridesDto } from './dto/set-user-overrides.dto';

import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { MODULE_KEYS, MODULE_LABELS } from '../auth/permission-constants';

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

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @Permissions('admin.delete')
  deleteRole(@Param('roleId') roleId: string) {
    return this.usersService.deleteRole(roleId);
  }

  @Get('module-keys')
  @Permissions('admin.view')
  getModuleKeys() {
    return { moduleKeys: MODULE_KEYS, labels: MODULE_LABELS };
  }

  @Get('permissions')
  @Permissions('admin.view')
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'groupBy', enum: ['module'], required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  listPermissions(
    @Query('search') search?: string,
    @Query('groupBy') groupBy?: 'module',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.listPermissions({
      search,
      groupBy,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('permissions/seed-app-pages')
  @Permissions('admin.update')
  seedAppPagePermissions() {
    return this.usersService.seedAppPagePermissions();
  }

  // ============================================
  //        USER ROLES & PERMISSION OVERRIDES
  // ============================================

  @Patch('dashboard/:userId/roles')
  @Permissions('admin.update')
  updateUserRoles(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.usersService.updateUserRoles(userId, dto.roleIds);
  }

  @Get(':userId/permission-overrides')
  @Permissions('admin.view')
  getUserPermissionOverrides(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.usersService.getUserPermissionOverrides(userId);
  }

  @Put(':userId/permission-overrides')
  @Permissions('admin.update')
  setUserPermissionOverrides(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SetUserOverridesDto,
  ) {
    return this.usersService.setUserPermissionOverrides(userId, dto.overrides);
  }

  @Get(':userId/resolve-permissions')
  @Permissions('admin.view')
  @ApiQuery({ name: 'unitId', type: String, required: false })
  resolvePermissions(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.usersService.resolvePermissions(userId, unitId);
  }

  // ============================================
  //     ROLE-STATUS PERMISSION MATRIX
  // ============================================

  @Get('roles/:roleId/status-permissions')
  @Permissions('admin.view')
  getRoleStatusPermissions(@Param('roleId') roleId: string) {
    return this.usersService.getRoleStatusPermissions(roleId);
  }

  @Put('roles/:roleId/status-permissions/:unitStatus')
  @Permissions('admin.update')
  setRoleStatusPermissions(
    @Param('roleId') roleId: string,
    @Param('unitStatus') unitStatus: string,
    @Body() dto: SetRoleStatusPermissionsDto,
  ) {
    return this.usersService.setRoleStatusPermissions(
      roleId,
      unitStatus,
      dto.permissionKeys,
    );
  }

  @Get(':id')
  @Permissions('user.read')
  getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getUserWithRelations(id);
  }

  @Patch(':id')
  @Permissions('user.update')
  updateUser(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('user.delete')
  deactivateUser(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Delete(':id/hard')
  @Permissions('user.delete')
  hardDeleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
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
  getResident(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getResident(id);
  }

  @Patch('residents/:id')
  @Permissions('resident.update')
  updateResident(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateResidentDto) {
    return this.usersService.updateResident(id, dto);
  }

  @Delete('residents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('resident.delete')
  deleteResident(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.deleteResident(id);
  }

  @Get('residents/:userId/overview')
  @Permissions('resident.view_full_profile')
  getResidentOverview(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.usersService.getResidentOverview(userId);
  }

  @Patch('residents/:userId/profile')
  @Permissions('resident.update_full_profile')
  updateResidentProfile(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateResidentProfileAdminDto,
  ) {
    return this.usersService.updateResidentFullProfile(userId, dto);
  }

  @Post('residents/:userId/units/assign')
  @Permissions('unit.assign_resident')
  assignResidentUnit(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: AssignResidentUnitDto,
  ) {
    return this.usersService.assignUnitToResidentUser(userId, dto);
  }

  @Delete('residents/:userId/units/:unitId')
  @Permissions('unit.remove_resident_from_unit')
  removeResidentUnit(@Param('userId', new ParseUUIDPipe()) userId: string, @Param('unitId') unitId: string) {
    return this.usersService.removeUnitFromResidentUser(userId, unitId);
  }

  @Post('residents/units/:unitId/transfer-ownership')
  @Permissions('unit.transfer_ownership')
  transferOwnership(
    @Param('unitId') unitId: string,
    @Body() dto: TransferOwnershipDto,
    @Request() req: any,
  ) {
    return this.usersService.transferUnitOwnership(unitId, dto, req.user.id);
  }

  @Get('residents/:userId/household-tree')
  @Permissions('resident.view_household_tree')
  getResidentHouseholdTree(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.usersService.getResidentHouseholdTree(userId, unitId);
  }

  @Get('residents/:userId/documents')
  @Permissions('resident.view_documents')
  getResidentDocuments(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.usersService.getResidentDocuments(userId);
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
  getOwner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getOwner(id);
  }

  @Patch('owners/:id')
  @Permissions('owner.update')
  updateOwner(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateOwnerDto) {
    return this.usersService.updateOwner(id, dto);
  }

  @Delete('owners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('owner.delete')
  deleteOwner(@Param('id', new ParseUUIDPipe()) id: string) {
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
  getTenant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getTenant(id);
  }

  @Patch('tenants/:id')
  @Permissions('tenant.update')
  updateTenant(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTenantDto) {
    return this.usersService.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('tenant.delete')
  deleteTenant(@Param('id', new ParseUUIDPipe()) id: string) {
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
  getAdmin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.getAdmin(id);
  }

  @Patch('admins/:id')
  @Permissions('admin.update')
  updateAdmin(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateAdminDto) {
    return this.usersService.updateAdmin(id, dto);
  }

  @Delete('admins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('admin.delete')
  deleteAdmin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.deleteAdmin(id);
  }
}

