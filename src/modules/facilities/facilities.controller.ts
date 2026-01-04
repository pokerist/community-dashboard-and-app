import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('Facilities')
@Controller('facilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Post()
  @Permissions('facility.create')
  @ApiOperation({ summary: 'Create a facility with slot config & exceptions' })
  create(@Body() dto: CreateFacilityDto) {
    return this.facilitiesService.create(dto);
  }

  @Get()
  @Permissions('facility.view_all')
  @ApiOperation({ summary: 'Get all facilities with configs' })
  findAll() {
    return this.facilitiesService.findAll();
  }

  @Get(':id')
  @Permissions('facility.view_all', 'facility.view_own')
  @ApiOperation({ summary: 'Get facility by ID' })
  findOne(@Param('id') id: string) {
    return this.facilitiesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('facility.update')
  @ApiOperation({ summary: 'Update facility settings' })
  update(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilitiesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('facility.delete')
  @ApiOperation({ summary: 'Delete a facility' })
  remove(@Param('id') id: string) {
    return this.facilitiesService.remove(id);
  }
}
