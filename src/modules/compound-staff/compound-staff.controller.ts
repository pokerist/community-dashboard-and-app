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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CompoundStaffService } from './compound-staff.service';
import { CreateCompoundStaffDto } from './dto/create-compound-staff.dto';
import { ListCompoundStaffActivityDto } from './dto/list-compound-staff-activity.dto';
import { ListCompoundStaffDto } from './dto/list-compound-staff.dto';
import { SetCompoundStaffAccessDto } from './dto/set-compound-staff-access.dto';
import { SetCompoundStaffGatesDto } from './dto/set-compound-staff-gates.dto';
import { UpdateCompoundStaffDto } from './dto/update-compound-staff.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@ApiTags('Compound Staff')
@Controller('compound-staff')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CompoundStaffController {
  constructor(private readonly compoundStaffService: CompoundStaffService) {}

  @Get()
  @Permissions('compound_staff.view_all', 'admin.view')
  list(@Query() query: ListCompoundStaffDto) {
    return this.compoundStaffService.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('compound_staff.create', 'admin.update')
  create(@Body() dto: CreateCompoundStaffDto, @Req() req: AuthenticatedRequest) {
    return this.compoundStaffService.create(dto, req.user.id);
  }

  @Get(':id')
  @Permissions('compound_staff.view_all', 'admin.view')
  getById(@Param('id') id: string) {
    return this.compoundStaffService.getById(id);
  }

  @Patch(':id')
  @Permissions('compound_staff.update', 'admin.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompoundStaffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.compoundStaffService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('compound_staff.delete', 'admin.update')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.compoundStaffService.remove(id, req.user.id);
  }

  @Get(':id/access')
  @Permissions('compound_staff.view_all', 'admin.view')
  getAccess(@Param('id') id: string) {
    return this.compoundStaffService.getAccess(id);
  }

  @Put(':id/access')
  @Permissions('compound_staff.update', 'admin.update')
  setAccess(
    @Param('id') id: string,
    @Body() dto: SetCompoundStaffAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.compoundStaffService.setAccess(id, dto, req.user.id);
  }

  @Get(':id/gates')
  @Permissions('compound_staff.view_all', 'admin.view')
  getGateAccesses(@Param('id') id: string) {
    return this.compoundStaffService.getGateAccesses(id);
  }

  @Put(':id/gates')
  @Permissions('compound_staff.update', 'admin.update')
  setGateAccesses(
    @Param('id') id: string,
    @Body() dto: SetCompoundStaffGatesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.compoundStaffService.setGateAccesses(id, dto, req.user.id);
  }

  @Get(':id/activity-logs')
  @Permissions('compound_staff.view_all', 'admin.view')
  getActivityLogs(
    @Param('id') id: string,
    @Query() query: ListCompoundStaffActivityDto,
  ) {
    return this.compoundStaffService.getActivityLogs(id, query);
  }

  @Get(':id/attendance')
  @Permissions('compound_staff.view_all', 'admin.view')
  getAttendance(@Param('id') id: string) {
    return this.compoundStaffService.getAttendance(id);
  }

  @Post(':id/clock-in')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('compound_staff.update', 'admin.update')
  clockIn(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.compoundStaffService.clockIn(id, req.user.id);
  }

  @Post(':id/clock-out')
  @HttpCode(HttpStatus.OK)
  @Permissions('compound_staff.update', 'admin.update')
  clockOut(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.compoundStaffService.clockOut(id, req.user.id);
  }
}
