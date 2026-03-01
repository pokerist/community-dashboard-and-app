import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResidentVehiclesController } from './resident-vehicles.controller';
import { ResidentVehiclesService } from './resident-vehicles.service';

@Module({
  imports: [AuthModule],
  controllers: [ResidentVehiclesController],
  providers: [ResidentVehiclesService],
})
export class ResidentVehiclesModule {}
