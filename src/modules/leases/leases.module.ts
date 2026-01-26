import { Module } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { LeasesController } from './leases.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  providers: [LeasesService],
  controllers: [LeasesController],
})
export class LeasesModule {}
