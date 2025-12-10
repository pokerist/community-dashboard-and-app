// src/service-request/service-request.module.ts (Updated)

import { Module } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';
import { ServiceRequestController } from './service-request.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // Import the Prisma module

@Module({
  imports: [PrismaModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService],
  exports: [ServiceRequestService],
})
export class ServiceRequestModule {}