import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { ApiTags, ApiBody } from '@nestjs/swagger';
import { UpdateUnitStatusDto } from './dto/update-unit-status.dto'; // new DTO for status updates
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('units')
@Controller('units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  // ----- CRUD -----
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('unit.delete')
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }

  // ----- User Assignment -----
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

  // ----- Status -----
  @Patch(':id/status')
  @ApiBody({ type: UpdateUnitStatusDto })
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.update_status')
  updateStatus(@Param('id') unitId: string, @Body() dto: UpdateUnitStatusDto) {
    return this.unitsService.updateStatus(unitId, dto.status);
  }

  // ----- Lease info -----
  @Get(':id/leases')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_leases')
  getLeases(@Param('id') unitId: string) {
    return this.unitsService.getLeases(unitId);
  }

  // ----- Get by unit number -----
  @Get('number/:unitNumber')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.view_all', 'unit.view_own')
  getByNumber(@Param('unitNumber') unitNumber: string) {
    return this.unitsService.getByNumber(unitNumber);
  }
}
