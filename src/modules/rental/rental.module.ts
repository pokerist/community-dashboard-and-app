import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RentRequestsModule } from '../rent-requests/rent-requests.module';
import { RentalController } from './rental.controller';
import { RentalService } from './rental.service';

@Module({
  imports: [PrismaModule, AuthModule, RentRequestsModule],
  controllers: [RentalController],
  providers: [RentalService],
  exports: [RentalService],
})
export class RentalModule {}

