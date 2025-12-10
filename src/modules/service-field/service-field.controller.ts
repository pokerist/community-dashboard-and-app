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
import { AuthGuard } from '@nestjs/passport'; // Placeholder
import { ServiceFieldService } from './service-field.service';
import { CreateServiceFieldDto } from './dto/create-service-field.dto';
import { UpdateServiceFieldDto } from './dto/update-service-field.dto';

// Use a nested routing structure: /services/:serviceId/fields
@Controller('service-fields') // Base controller path (can be changed to 'services/:serviceId/fields' if preferred)
export class ServiceFieldController {
  constructor(private readonly serviceFieldService: ServiceFieldService) {}

  // POST /service-fields (Admin: Create a new field)
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createServiceFieldDto: CreateServiceFieldDto) {
    // This endpoint allows creating a field for any service by requiring serviceId in the DTO
    return this.serviceFieldService.create(createServiceFieldDto);
  }

  // GET /service-fields?serviceId=uuid (Community App: Fetch form fields for a service)
  @Get()
  findByService(@Query('serviceId') serviceId: string) {
    if (!serviceId) {
      // For Admin, you might want to fetch all fields, but for app, filter by service is key
      throw new BadRequestException('Query parameter "serviceId" is required.');
    }
    // This is the primary endpoint for the Community App to render a dynamic form.
    return this.serviceFieldService.findByService(serviceId);
  }

  // PATCH /service-fields/:id (Admin: Update a field)
  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateServiceFieldDto: UpdateServiceFieldDto,
  ) {
    return this.serviceFieldService.update(id, updateServiceFieldDto);
  }

  // DELETE /service-fields/:id (Admin: Delete a field)
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceFieldService.remove(id);
  }
}
