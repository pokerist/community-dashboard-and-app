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
} from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { ApiTags, ApiBody } from '@nestjs/swagger';
import { UpdateUnitStatusDto } from './dto/update-unit-status.dto'; // new DTO for status updates

@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  // ----- CRUD -----
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Query() query: UnitQueryDto) {
    return this.unitsService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUnitDto })
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.unitsService.remove(id);
  }

  // ----- User Assignment -----
  @Post(':id/assign-user')
  @HttpCode(HttpStatus.CREATED)
  assignUser(@Param('id') unitId: string, @Body() dto: AssignUserDto) {
    return this.unitsService.assignUser(unitId, dto.userId, dto.role);
  }

  @Delete(':id/assigned-users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUser(@Param('id') unitId: string, @Param('userId') userId: string) {
    return this.unitsService.removeUser(unitId, userId);
  }

  @Get(':id/users')
  @HttpCode(HttpStatus.OK)
  getUsers(@Param('id') unitId: string) {
    return this.unitsService.getUsers(unitId);
  }

  // ----- Status -----
  @Patch(':id/status')
  @ApiBody({ type: UpdateUnitStatusDto })
  @HttpCode(HttpStatus.OK)
  updateStatus(@Param('id') unitId: string, @Body() dto: UpdateUnitStatusDto) {
    return this.unitsService.updateStatus(unitId, dto.status);
  }

  // ----- Lease info -----
  @Get(':id/leases')
  @HttpCode(HttpStatus.OK)
  getLeases(@Param('id') unitId: string) {
    return this.unitsService.getLeases(unitId);
  }

  // ----- Get by unit number -----
  @Get('number/:unitNumber')
  @HttpCode(HttpStatus.OK)
  getByNumber(@Param('unitNumber') unitNumber: string) {
    return this.unitsService.getByNumber(unitNumber);
  }
}
