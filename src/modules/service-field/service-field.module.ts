import { Module } from '@nestjs/common';
import { ServiceFieldService } from './service-field.service';
import { ServiceFieldController } from './service-field.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ServiceFieldController],
  providers: [ServiceFieldService],
})
export class ServiceFieldModule {}
