import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path as needed
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [UnitsController],
  providers: [UnitsService, PrismaService],
})
export class UnitsModule {}
