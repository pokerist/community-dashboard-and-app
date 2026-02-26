// src/service-request/service-request.module.ts (Updated)

import { Module } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';
import { ServiceRequestController } from './service-request.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // Import the Prisma module
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, InvoicesModule, NotificationsModule],
  controllers: [ServiceRequestController],
  providers: [ServiceRequestService],
  exports: [ServiceRequestService],
})
export class ServiceRequestModule {}
