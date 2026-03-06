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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CreateGateRequestDto } from './dto/create-gate-request.dto';
import { GetGateStatsDto } from './dto/get-gate-stats.dto';
import { ListGateLogsDto } from './dto/list-gate-logs.dto';
import { ListGatesDto } from './dto/list-gates.dto';
import { SetGateUnitsDto } from './dto/set-gate-units.dto';
import { UpdateGateDto } from './dto/update-gate.dto';
import { UpdateGateRolesDto } from './dto/update-gate-roles.dto';
import { GatesService } from './gates.service';

@ApiTags('Gates')
@Controller('gates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  @Permissions('gate.view_all', 'admin.view')
  listGates(@Query() query: ListGatesDto) {
    return this.gatesService.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('gate.create', 'admin.update')
  createGate(@Body() dto: CreateGateRequestDto) {
    return this.gatesService.create(dto);
  }

  @Get('stats')
  @Permissions('gate.view_all', 'admin.view')
  getGateStats(@Query() query: GetGateStatsDto) {
    return this.gatesService.getGateStats(query.communityId);
  }

  @Get('logs')
  @Permissions('gate.logs.view', 'admin.view')
  listLogs(@Query() query: ListGateLogsDto) {
    return this.gatesService.listLogs(query);
  }

  @Get('units/:unitId')
  @Permissions('gate.view_all', 'admin.view')
  listGatesForUnit(@Param('unitId') unitId: string) {
    return this.gatesService.listGatesForUnit(unitId);
  }

  @Get(':id/log')
  @Permissions('gate.logs.view', 'admin.view')
  getGateLog(@Param('id') id: string, @Query() query: ListGateLogsDto) {
    return this.gatesService.getGateLog(id, query);
  }

  @Get(':id')
  @Permissions('gate.view_all', 'admin.view')
  getById(@Param('id') id: string) {
    return this.gatesService.getById(id);
  }

  @Patch(':id')
  @Permissions('gate.update', 'admin.update')
  updateGate(@Param('id') id: string, @Body() dto: UpdateGateDto) {
    return this.gatesService.update(id, dto);
  }

  @Patch(':id/roles')
  @Permissions('gate.update', 'admin.update')
  updateRoles(@Param('id') id: string, @Body() dto: UpdateGateRolesDto) {
    return this.gatesService.updateGateRoles(id, dto.roles);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('gate.delete', 'admin.update')
  softDeleteGate(@Param('id') id: string) {
    return this.gatesService.softDeleteGate(id);
  }

  @Get(':id/units')
  @Permissions('gate.view_all', 'admin.view')
  listUnits(@Param('id') id: string) {
    return this.gatesService.listUnits(id);
  }

  @Put(':id/units')
  @Permissions('gate.update', 'admin.update')
  setUnits(@Param('id') id: string, @Body() dto: SetGateUnitsDto) {
    return this.gatesService.setUnits(id, dto);
  }
}
