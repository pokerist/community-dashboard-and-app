import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
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
  @Permissions('facility.view_all', 'facility.view_own')
  @ApiOperation({ summary: 'Get all facilities with configs' })
  findAll(@Req() req: any) {
    return this.facilitiesService.findAllForActor({
      actorUserId: req.user?.id,
      permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
    });
  }

  @Get(':id')
  @Permissions('facility.view_all', 'facility.view_own')
  @ApiOperation({ summary: 'Get facility by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.facilitiesService.findOneForActor(id, {
      actorUserId: req.user?.id,
      permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : [],
      roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
    });
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
