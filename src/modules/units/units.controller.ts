import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { DeactivateUnitDto } from './dto/deactivate-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdateUnitGateAccessDto } from './dto/update-unit-gate-access.dto';
import { UpdateUnitStatusDto } from './dto/update-unit-status.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    roles?: string[];
    permissions?: string[];
  };
};

@ApiTags('units')
@Controller('units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_own', 'unit.view_all')
  findMyUnits(@Query() query: UnitQueryDto, @Req() req: AuthenticatedRequest) {
    return this.unitsService.findMyUnits(req.user.id, query, {
      permissions: Array.isArray(req.user.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user.roles) ? req.user.roles : [],
    });
  }

  @Get('number/:unitNumber')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all', 'unit.view_own')
  getByNumber(@Param('unitNumber') unitNumber: string) {
    return this.unitsService.getByNumber(unitNumber);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all')
  findAll(@Query() query: UnitQueryDto) {
    return this.unitsService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all', 'unit.view_own')
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('unit.create')
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUnitDto })
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.update')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.delete')
  remove(@Param('id') id: string, @Body() dto?: DeactivateUnitDto) {
    return this.unitsService.remove(id, dto);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.update', 'admin.update')
  reactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.unitsService.reactivate(id, req.user.id);
  }

  @Get(':id/gate-access')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all', 'unit.view_own')
  getUnitGateAccess(@Param('id') id: string) {
    return this.unitsService.getUnitGateAccess(id);
  }

  @Patch(':id/gate-access')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.update')
  updateUnitGateAccess(
    @Param('id') id: string,
    @Body() dto: UpdateUnitGateAccessDto,
  ) {
    return this.unitsService.updateGateAccess(id, dto);
  }

  @Get('clusters/:clusterId')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all')
  getUnitsByCluster(@Param('clusterId') clusterId: string) {
    return this.unitsService.getUnitsByCluster(clusterId);
  }

  @Post(':id/assign-user')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('unit.assign_resident')
  assignUser(@Param('id') unitId: string, @Body() dto: AssignUserDto) {
    return this.unitsService.assignUser(unitId, dto.userId, dto.role);
  }

  @Delete(':id/assigned-users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('unit.remove_resident_from_unit')
  removeUser(@Param('id') unitId: string, @Param('userId') userId: string) {
    return this.unitsService.removeUser(unitId, userId);
  }

  @Get(':id/residents')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_assigned_residents')
  getUsers(@Param('id') unitId: string) {
    return this.unitsService.getUsers(unitId);
  }

  @Patch(':id/status')
  @ApiBody({ type: UpdateUnitStatusDto })
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.update_status')
  updateStatus(@Param('id') unitId: string, @Body() dto: UpdateUnitStatusDto) {
    return this.unitsService.updateStatus(unitId, dto.status);
  }

  @Get(':id/leases')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_leases')
  getLeases(@Param('id') unitId: string) {
    return this.unitsService.getLeases(unitId);
  }

  @Get('access/:unitId/:userId')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all')
  getUserAccess(
    @Param('unitId') unitId: string,
    @Param('userId') userId: string,
  ) {
    return this.unitsService.getUserAccessForUnit(unitId, userId);
  }

  @Get('can-access-feature/:unitId')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all')
  async canAccessFeature(
    @Param('unitId') unitId: string,
    @Query('feature') feature: string,
  ) {
    const hasAccess = await this.unitsService.canAccessFeature(unitId, feature);
    return { canAccess: hasAccess };
  }
}

