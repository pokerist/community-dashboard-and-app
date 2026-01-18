import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { UpdatePendingRegistrationDto } from './dto/update-pending-registration.dto';
import { ApprovePendingRegistrationDto } from './dto/approve-pending-registration.dto';
import { ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { Request } from 'express';

@ApiTags('Admin Pending Registrations')
@Controller('admin/pending-registrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PendingRegistrationsController {
  constructor(private readonly service: PendingRegistrationsService) {}

  @Get()
  @Permissions('pending_registration.view_all')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('pending_registration.view_own')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('pending_registration.update')
  update(@Param('id') id: string, @Body() dto: UpdatePendingRegistrationDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/reject')
  @Permissions('pending_registration.reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  @Patch(':id/approve')
  @Permissions('pending_registration.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovePendingRegistrationDto,
    @Req() req: any,
  ) {
    return this.service.approve(id, dto, req.user.id);
  }
}
