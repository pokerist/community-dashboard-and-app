// src/service/service.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AuthGuard } from '@nestjs/passport'; // Placeholder
// import { RolesGuard } from '../auth/guards/roles.guard'; // Assume you have a RolesGuard
// import { Roles } from '../auth/decorators/roles.decorator'; // Assume you have a Roles decorator
// import { Role } from '@prisma/client';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  // POST /services (Admin: Create New Service Type)
  @UseGuards(AuthGuard('jwt')) // , RolesGuard)
  // @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Post()
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.serviceService.create(createServiceDto);
  }

  // GET /services?active=true (Community App & Dashboard: List available services)
  @Get()
  findAll(@Query('active') active?: string) {
    const onlyActive = active !== 'false';
    return this.serviceService.findAll(onlyActive);
  }

  // GET /services/:id (Admin: View details)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  // PATCH /services/:id (Admin: Update status, price, etc.)
  @UseGuards(AuthGuard('jwt')) // , RolesGuard)
  // @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.serviceService.update(id, updateServiceDto);
  }

  // DELETE /services/:id (Admin: Remove a service)
  @UseGuards(AuthGuard('jwt')) // , RolesGuard)
  // @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}
