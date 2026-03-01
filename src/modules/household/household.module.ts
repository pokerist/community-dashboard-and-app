import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';

@Module({
  imports: [PrismaModule, InvoicesModule, NotificationsModule],
  controllers: [HouseholdController],
  providers: [HouseholdService],
  exports: [HouseholdService],
})
export class HouseholdModule {}
