import { Module } from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { PendingRegistrationsController } from './pending-registrations.controller';
import { SignupController } from './signup.controller';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  controllers: [PendingRegistrationsController, SignupController],
  providers: [PendingRegistrationsService],
})
export class PendingRegistrationsModule {}
