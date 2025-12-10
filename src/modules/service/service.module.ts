// src/service/service.module.ts (Updated)

import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ServiceFieldService } from '../service-field/service-field.service';
import { ServiceFieldController } from '../service-field/service-field.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceController, ServiceFieldController], // Add new controller
  providers: [ServiceService, ServiceFieldService], // Add new service
  exports: [ServiceService],
})
export class ServiceModule {}
