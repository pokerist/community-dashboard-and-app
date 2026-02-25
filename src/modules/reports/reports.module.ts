import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsScheduler } from './reports.scheduler';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsScheduler],
  exports: [ReportsService],
})
export class ReportsModule {}
