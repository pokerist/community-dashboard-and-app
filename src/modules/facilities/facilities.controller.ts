import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AddSlotExceptionDto } from './dto/add-slot-exception.dto';
import { CreateFacilityDto } from './dto/create-facility.dto';
import {
  FacilitiesQueryDto,
  FacilityAvailableSlotsQueryDto,
} from './dto/facilities-query.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { UpsertSlotConfigDto } from './dto/upsert-slot-config.dto';
import { FacilitiesService } from './facilities.service';

@ApiTags('Facilities')
@Controller('facilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @Permissions('facility.view_all', 'facility.view_own')
  listFacilities(@Query() query: FacilitiesQueryDto) {
    return this.facilitiesService.listFacilities(query.includeInactive);
  }

  @Get('stats')
  @Permissions('facility.view_all', 'booking.view_all')
  getAmenityStats() {
    return this.facilitiesService.getAmenityStats();
  }

  @Get(':id')
  @Permissions('facility.view_all', 'facility.view_own')
  getFacilityDetail(@Param('id') id: string) {
    return this.facilitiesService.getFacilityDetail(id);
  }

  @Post()
  @Permissions('facility.create')
  createFacility(@Body() dto: CreateFacilityDto) {
    return this.facilitiesService.createFacility(dto);
  }

  @Patch(':id')
  @Permissions('facility.update')
  updateFacility(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilitiesService.updateFacility(id, dto);
  }

  @Patch(':id/toggle')
  @Permissions('facility.update')
  toggleFacility(@Param('id') id: string) {
    return this.facilitiesService.toggleFacility(id);
  }

  @Put(':id/slots/:dayOfWeek')
  @Permissions('facility.update')
  upsertSlotConfig(
    @Param('id') facilityId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body() dto: UpsertSlotConfigDto,
  ) {
    return this.facilitiesService.upsertSlotConfig(facilityId, dayOfWeek, dto);
  }

  @Delete('slots/:id')
  @Permissions('facility.update')
  removeSlotConfig(@Param('id') id: string) {
    return this.facilitiesService.removeSlotConfig(id);
  }

  @Post(':id/exceptions')
  @Permissions('facility.update')
  addSlotException(@Param('id') facilityId: string, @Body() dto: AddSlotExceptionDto) {
    return this.facilitiesService.addSlotException(facilityId, dto);
  }

  @Delete('exceptions/:id')
  @Permissions('facility.update')
  removeSlotException(@Param('id') id: string) {
    return this.facilitiesService.removeSlotException(id);
  }

  @Get(':id/available-slots')
  @Permissions('facility.view_all', 'facility.view_own', 'booking.create')
  getAvailableSlots(
    @Param('id') facilityId: string,
    @Query() query: FacilityAvailableSlotsQueryDto,
  ) {
    return this.facilitiesService.getAvailableSlots(facilityId, query.date);
  }
}
