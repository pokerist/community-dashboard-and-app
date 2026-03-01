import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FacilitiesModule } from '../facilities/facilities.module';
import { AuthModule } from '../auth/auth.module';
import { ClubhouseModule } from '../clubhouse/clubhouse.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [
    PrismaModule,
    FacilitiesModule,
    AuthModule,
    ClubhouseModule,
    InvoicesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
