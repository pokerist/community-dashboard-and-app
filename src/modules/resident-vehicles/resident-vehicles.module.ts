import { Module } from '@nestjs/common';
import { ResidentVehiclesController } from './resident-vehicles.controller';
import { ResidentVehiclesService } from './resident-vehicles.service';

@Module({
  controllers: [ResidentVehiclesController],
  providers: [ResidentVehiclesService],
})
export class ResidentVehiclesModule {}

