import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { HelpCenterController } from './help-center.controller';
import { HelpCenterService } from './help-center.service';

@Module({
  imports: [PrismaModule],
  controllers: [HelpCenterController],
  providers: [HelpCenterService],
  exports: [HelpCenterService],
})
export class HelpCenterModule {}
