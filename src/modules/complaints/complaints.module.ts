import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [AuthModule, InvoicesModule, NotificationsModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService, PrismaService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
