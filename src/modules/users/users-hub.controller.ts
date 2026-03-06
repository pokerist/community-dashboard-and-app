import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ListCompoundStaffDto } from '../compound-staff/dto/list-compound-staff.dto';
import { UsersService } from './users.service';
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
  ActivateUserDto,
  SuspendUserDto,
} from './dto/user-status-action.dto';

@ApiTags('Users Hub')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersHubController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  @Permissions('user.read', 'admin.view')
  getAllUserStats() {
    return this.usersService.getAllUserStats();
  }

  @Get('owners')
  @Permissions('owner.view', 'admin.view')
  listOwners(@Query() query: ListOwnersQueryDto) {
    return this.usersService.listOwners(query);
  }

  @Get('family-members')
  @Permissions('resident.view', 'admin.view')
  listFamilyMembers(@Query() query: ListFamilyMembersQueryDto) {
    return this.usersService.listFamilyMembers(query);
  }

  @Get('tenants')
  @Permissions('tenant.view', 'admin.view')
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.usersService.listTenants(query);
  }

  @Get('home-staff')
  @Permissions('resident.view_household_tree', 'admin.view')
  listHomeStaff(@Query() query: ListHomeStaffQueryDto) {
    return this.usersService.listHomeStaff(query);
  }

  @Get('delegates')
  @Permissions('resident.view_household_tree', 'admin.view')
  listDelegates(@Query() query: ListDelegatesQueryDto) {
    return this.usersService.listDelegates(query);
  }

  @Get('brokers')
  @Permissions('admin.view', 'user.read')
  listBrokers(@Query() query: ListBrokersQueryDto) {
    return this.usersService.listBrokers(query);
  }

  @Get('compound-staff')
  @Permissions('compound_staff.view_all', 'admin.view')
  listCompoundStaff(@Query() query: ListCompoundStaffDto) {
    return this.usersService.listCompoundStaff(query);
  }

  @Get('system-users')
  @Permissions('admin.view')
  listSystemUsers(@Query() query: ListSystemUsersQueryDto) {
    return this.usersService.listSystemUsers(query);
  }

  @Get(':id')
  @Permissions('user.read', 'admin.view')
  getUserDetail(@Param('id') userId: string) {
    return this.usersService.getUserDetail(userId);
  }

  @Patch(':id/suspend')
  @Permissions('user.update', 'admin.update')
  suspendUser(@Param('id') userId: string, @Body() dto: SuspendUserDto) {
    return this.usersService.suspendUser(userId, dto.reason);
  }

  @Patch(':id/activate')
  @Permissions('user.update', 'admin.update')
  activateUser(@Param('id') userId: string, @Body() dto: ActivateUserDto) {
    return this.usersService.activateUser(userId, dto.note);
  }
}

