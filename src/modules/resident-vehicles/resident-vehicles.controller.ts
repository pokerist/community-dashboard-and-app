import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateResidentVehicleDto } from './dto/create-resident-vehicle.dto';
import { UpdateResidentVehicleDto } from './dto/update-resident-vehicle.dto';
import { ResidentVehiclesService } from './resident-vehicles.service';

@ApiTags('Resident Vehicles')
@Controller('resident-vehicles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResidentVehiclesController {
  constructor(private readonly residentVehiclesService: ResidentVehiclesService) {}

  @Get('me')
  @ApiOperation({ summary: 'List my vehicles' })
  listMine(@Req() req: any) {
    return this.residentVehiclesService.listMyVehicles(req.user.id);
  }

  @Post('me')
  @ApiOperation({ summary: 'Create my vehicle' })
  createMine(@Body() dto: CreateResidentVehicleDto, @Req() req: any) {
    return this.residentVehiclesService.createMyVehicle(req.user.id, dto);
  }

  @Patch('me/:id')
  @ApiOperation({ summary: 'Update my vehicle' })
  updateMine(
    @Param('id') id: string,
    @Body() dto: UpdateResidentVehicleDto,
    @Req() req: any,
  ) {
    return this.residentVehiclesService.updateMyVehicle(req.user.id, id, dto);
  }

  @Delete('me/:id')
  @ApiOperation({ summary: 'Delete my vehicle' })
  deleteMine(@Param('id') id: string, @Req() req: any) {
    return this.residentVehiclesService.deleteMyVehicle(req.user.id, id);
  }
}

