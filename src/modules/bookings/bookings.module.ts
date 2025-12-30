import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FacilitiesModule } from '../facilities/facilities.module';

@Module({
  imports: [PrismaModule, FacilitiesModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
