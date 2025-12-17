// src/service/service-field.controller.ts

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
  BadRequestException
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport'; // Placeholder
import { ServiceFieldService } from './service-field.service';
import { CreateServiceFieldDto } from './dto/create-service-field.dto';
import { UpdateServiceFieldDto } from './dto/update-service-field.dto';

// Use a nested routing structure: /services/:serviceId/fields
@ApiTags('Service Fields')
@Controller('service-fields') // Base controller path (can be changed to 'services/:serviceId/fields' if preferred)
export class ServiceFieldController {
  constructor(private readonly serviceFieldService: ServiceFieldService) {}

  // POST /service-fields (Admin: Create a new field)
  // @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiOperation({
    summary: 'Create a service form field',
    description:
      'Creates a dynamic form field configuration for a service (label, type, required, order, etc.).',
  })
  create(@Body() createServiceFieldDto: CreateServiceFieldDto) {
    // This endpoint allows creating a field for any service by requiring serviceId in the DTO
    return this.serviceFieldService.create(createServiceFieldDto);
  }

  // GET /service-fields?serviceId=uuid (Community App: Fetch form fields for a service)
  @Get()
  @ApiOperation({
    summary: 'List fields for a service',
    description:
      'Returns the dynamic form fields for the given `serviceId`. Used by the Community App to render service request forms.',
  })
  findByService(@Query('serviceId') serviceId: string) {
    if (!serviceId) {
      // For Admin, you might want to fetch all fields, but for app, filter by service is key
      throw new BadRequestException('Query parameter "serviceId" is required.');
    }
    // This is the primary endpoint for the Community App to render a dynamic form.
    return this.serviceFieldService.findByService(serviceId);
  }

  // PATCH /service-fields/:id (Admin: Update a field)
  // @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiOperation({ summary: 'Update a service form field' })
  update(
    @Param('id') id: string,
    @Body() updateServiceFieldDto: UpdateServiceFieldDto,
  ) {
    return this.serviceFieldService.update(id, updateServiceFieldDto);
  }

  // DELETE /service-fields/:id (Admin: Delete a field)
  // @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service form field' })
  remove(@Param('id') id: string) {
    return this.serviceFieldService.remove(id);
  }
}
