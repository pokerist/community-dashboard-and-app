import { Module } from '@nestjs/common';
import { HospitalityController } from './hospitality.controller';
import { HospitalityService } from './hospitality.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HospitalityController],
  providers: [HospitalityService],
  exports: [HospitalityService],
})
export class HospitalityModule {}
