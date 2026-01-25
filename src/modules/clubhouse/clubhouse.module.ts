import { Module } from '@nestjs/common';
import { ClubhouseService } from './clubhouse.service';
import { ClubhouseController } from './clubhouse.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClubhouseController],
  providers: [ClubhouseService],
  exports: [ClubhouseService],
})
export class ClubhouseModule {}
