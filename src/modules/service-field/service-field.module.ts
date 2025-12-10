import { Module } from '@nestjs/common';
import { ServiceFieldService } from './service-field.service';
import { ServiceFieldController } from './service-field.controller';

@Module({
  controllers: [ServiceFieldController],
  providers: [ServiceFieldService],
})
export class ServiceFieldModule {}
