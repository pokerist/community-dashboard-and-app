import { Module } from '@nestjs/common';
import { PendingRegistrationsService } from './pending-registrations.service';
import { PendingRegistrationsController } from './pending-registrations.controller';

@Module({
  controllers: [PendingRegistrationsController],
  providers: [PendingRegistrationsService],
})
export class PendingRegistrationsModule {}
