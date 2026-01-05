import { Module } from '@nestjs/common';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
