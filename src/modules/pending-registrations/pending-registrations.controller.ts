import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { CreatePendingRegistrationDto } from './dto/create-pending-registration.dto';
import { UpdatePendingRegistrationDto } from './dto/update-pending-registration.dto';
import { ApprovePendingRegistrationDto } from './dto/approve-pending-registration.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Pending Registrations')
@Controller('pending-registrations')
export class PendingRegistrationsController {
  constructor(private readonly service: PendingRegistrationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePendingRegistrationDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePendingRegistrationDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApprovePendingRegistrationDto) {
    return this.service.approve(id, dto);
  }
}
