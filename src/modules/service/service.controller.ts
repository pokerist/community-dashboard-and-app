import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ReorderServicesDto } from './dto/reorder-services.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceService } from './service.service';

@ApiBearerAuth()
@ApiTags('Services')
@Controller('services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @ApiOperation({ summary: 'List services with filters and catalog metrics' })
  @Permissions('service.read', 'service_request.create')
  listServices(@Query() query: ListServicesQueryDto) {
    return this.serviceService.listServices(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get service catalog and request statistics' })
  @Permissions('service.read')
  getServiceStats() {
    return this.serviceService.getServiceStats();
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Get service detail with fields and SLA stats' })
  @Permissions('service.read', 'service_request.create')
  getServiceDetail(@Param('id') id: string) {
    return this.serviceService.getServiceDetail(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a service with optional dynamic fields' })
  @Permissions('service.create')
  createService(@Body() dto: CreateServiceDto) {
    return this.serviceService.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder service catalog items' })
  @Permissions('service.update')
  reorder(@Body() dto: ReorderServicesDto) {
    return this.serviceService.reorder(dto.ids);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Update service properties and fields' })
  @Permissions('service.update')
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.serviceService.update(id, dto);
  }

  @Patch(':id([0-9a-fA-F-]{36})/toggle')
  @ApiOperation({ summary: 'Toggle service active/inactive status' })
  @Permissions('service.update')
  toggleService(@Param('id') id: string) {
    return this.serviceService.toggleService(id);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Delete a service with no linked requests' })
  @Permissions('service.delete')
  removeService(@Param('id') id: string) {
    return this.serviceService.remove(id);
  }
}

