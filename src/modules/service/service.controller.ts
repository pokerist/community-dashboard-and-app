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
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ReorderServicesDto } from './dto/reorder-services.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiBearerAuth()
@ApiTags('Services')
@Controller('services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  // POST /services (Admin: Create New Service Type)
  @Post()
  @ApiOperation({
    summary: 'Create a service type',
    description:
      'Creates a new service in the catalog (name, category, eligibility, visibility status, pricing, etc.).',
  })
  @Permissions('service.create')
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.serviceService.create(createServiceDto);
  }

  // GET /services?status=active|inactive|all (Community App & Dashboard: List services)
  @Get()
  @ApiOperation({
    summary: 'List services',
    description:
      'Lists service types. Use `status=active` (default) for active only, `status=inactive` for inactive only, or `status=all` for both active and inactive services.',
  })
  @Permissions('service.read', 'service_request.create')
  findAll(
    @Query('status') status?: string,
    @Query('urgent') urgent?: string,
    @Query('category') category?: string,
    @Query('kind') kind?: 'services' | 'requests' | 'all',
  ) {
    let filter: boolean | undefined;
    let urgentFilter: boolean | undefined;

    if (status === 'active') filter = true;
    else if (status === 'inactive') filter = false;
    else filter = undefined; // "all"

    if (urgent === 'true') urgentFilter = true;
    else if (urgent === 'false') urgentFilter = false;
    else urgentFilter = undefined;

    return this.serviceService.findAll(filter, urgentFilter, category, kind);
  }

  @Patch('reorder')
  @ApiOperation({
    summary: 'Reorder service catalog items',
    description:
      'Saves ordered service IDs to displayOrder so app/dashboard can render predictable ordering.',
  })
  @Permissions('service.update')
  reorder(@Body() dto: ReorderServicesDto) {
    return this.serviceService.reorder(dto.ids);
  }

  // GET /services/:id (Admin: View details)
  @Get(':id')
  @ApiOperation({ summary: 'Get a service by id' })
  @Permissions('service.read', 'service_request.create')
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  // PATCH /services/:id (Admin: Update status, price, etc.)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a service',
    description:
      'Updates service properties such as visibility (status), processing time, description, or pricing.',
  })
  @Permissions('service.update')
  update(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return this.serviceService.update(id, updateServiceDto);
  }

  // DELETE /services/:id (Admin: Remove a service)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service' })
  @Permissions('service.delete')
  remove(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}
