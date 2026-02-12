import { Module } from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { PendingRegistrationsController } from './pending-registrations.controller';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  // Intentionally shelf public signup endpoint (`POST /signup`) for now.
  // Admin-driven onboarding is handled by the Owners module.
  controllers: [PendingRegistrationsController],
  providers: [PendingRegistrationsService],
})
export class PendingRegistrationsModule {}
