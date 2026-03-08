import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateResidentVehicleDto } from './dto/create-resident-vehicle.dto';
import { UpdateResidentVehicleDto } from './dto/update-resident-vehicle.dto';
import { ResidentVehiclesService } from './resident-vehicles.service';

@ApiTags('Resident Vehicles')
@Controller('resident-vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ResidentVehiclesController {
  constructor(private readonly residentVehiclesService: ResidentVehiclesService) {}

  @Get('me')
  @Permissions('vehicle.view_own')
  @ApiOperation({ summary: 'List my vehicles' })
  listMine(@Req() req: any) {
    return this.residentVehiclesService.listMyVehicles(req.user.id);
  }

  @Post('me')
  @Permissions('vehicle.create')
  @ApiOperation({ summary: 'Create my vehicle' })
  createMine(@Body() dto: CreateResidentVehicleDto, @Req() req: any) {
    return this.residentVehiclesService.createMyVehicle(req.user.id, dto);
  }

  @Patch('me/:id')
  @Permissions('vehicle.update')
  @ApiOperation({ summary: 'Update my vehicle' })
  updateMine(
    @Param('id') id: string,
    @Body() dto: UpdateResidentVehicleDto,
    @Req() req: any,
  ) {
    return this.residentVehiclesService.updateMyVehicle(req.user.id, id, dto);
  }

  @Delete('me/:id')
  @Permissions('vehicle.delete')
  @ApiOperation({ summary: 'Delete my vehicle' })
  deleteMine(@Param('id') id: string, @Req() req: any) {
    return this.residentVehiclesService.deleteMyVehicle(req.user.id, id);
  }
}
