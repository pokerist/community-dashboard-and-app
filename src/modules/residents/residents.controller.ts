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
import { ResidentService } from './residents.service';

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

import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly residentService: ResidentService) {}

  // ============================================
  //                 USERS
  // ============================================
  @Post()
  @Permissions('user.create')
  createUser(@Body() dto: CreateUserDto, @Request() req) {
    return this.residentService.createUser(dto, {
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
    return this.residentService.findAllUsers(
      userType,
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get(':id')
  @Permissions('user.read')
  getUser(@Param('id') id: string) {
    return this.residentService.getUserWithRelations(id);
  }

  @Patch(':id')
  @Permissions('user.update')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.residentService.updateUser(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('user.delete')
  deactivateUser(@Param('id') id: string) {
    return this.residentService.deactivateUser(id);
  }

  // ============================================
  //                RESIDENTS
  // ============================================

  @Post('residents')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('resident.create')
  createResident(@Body() dto: CreateResidentDto) {
    return this.residentService.createResident(dto);
  }

  @Get('residents')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('resident.view')
  findAllResidents(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.residentService.findAllResidents(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('residents/:id')
  @Permissions('resident.view')
  getResident(@Param('id') id: string) {
    return this.residentService.getResident(id);
  }

  @Patch('residents/:id')
  @Permissions('resident.update')
  updateResident(@Param('id') id: string, @Body() dto: UpdateResidentDto) {
    return this.residentService.updateResident(id, dto);
  }

  @Delete('residents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('resident.delete')
  deleteResident(@Param('id') id: string) {
    return this.residentService.deleteResident(id);
  }

  // ============================================
  //                 OWNERS
  // ============================================

  @Post('owners')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('owner.create')
  createOwner(@Body() dto: CreateOwnerDto) {
    return this.residentService.createOwner(dto);
  }

  @Get('owners')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('owner.view')
  findAllOwners(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.residentService.findAllOwners(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('owners/:id')
  @Permissions('owner.view')
  getOwner(@Param('id') id: string) {
    return this.residentService.getOwner(id);
  }

  @Patch('owners/:id')
  @Permissions('owner.update')
  updateOwner(@Param('id') id: string, @Body() dto: UpdateOwnerDto) {
    return this.residentService.updateOwner(id, dto);
  }

  @Delete('owners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('owner.delete')
  deleteOwner(@Param('id') id: string) {
    return this.residentService.deleteOwner(id);
  }

  // ============================================
  //                 TENANTS
  // ============================================

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('tenant.create')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.residentService.createTenant(dto);
  }

  @Get('tenants')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('tenant.view')
  findAllTenants(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.residentService.findAllTenants(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('tenants/:id')
  @Permissions('tenant.view')
  getTenant(@Param('id') id: string) {
    return this.residentService.getTenant(id);
  }

  @Patch('tenants/:id')
  @Permissions('tenant.update')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.residentService.updateTenant(id, dto);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('tenant.delete')
  deleteTenant(@Param('id') id: string) {
    return this.residentService.deleteTenant(id);
  }

  // ============================================
  //                 ADMINS
  // ============================================

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('admin.create')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.residentService.createAdmin(dto);
  }

  @Get('admins')
  @ApiQuery({ name: 'skip', type: Number, required: false })
  @ApiQuery({ name: 'take', type: Number, required: false })
  @Permissions('admin.view')
  findAllAdmins(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.residentService.findAllAdmins(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 20,
    );
  }

  @Get('admins/:id')
  @Permissions('admin.view')
  getAdmin(@Param('id') id: string) {
    return this.residentService.getAdmin(id);
  }

  @Patch('admins/:id')
  @Permissions('admin.update')
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.residentService.updateAdmin(id, dto);
  }

  @Delete('admins/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('admin.delete')
  deleteAdmin(@Param('id') id: string) {
    return this.residentService.deleteAdmin(id);
  }
}
