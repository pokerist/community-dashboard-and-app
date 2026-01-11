import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { UnitsModule } from './modules/units/units.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FileModule } from './modules/file/file.module';
import { ServiceRequestModule } from './modules/service-request/service-request.module';
import { ServiceModule } from './modules/service/service.module';
import { ServiceFieldModule } from './modules/service-field/service-field.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { ViolationsModule } from './modules/violations/violations.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ResidentModule } from './modules/residents/residents.module';
import { PendingRegistrationsModule } from './modules/pending-registrations/pending-registrations.module';
import { EventsModule } from './events/events.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    InvoicesModule,
    UnitsModule,
    EventEmitterModule.forRoot(),
    FileModule,
    ServiceRequestModule,
    ServiceModule,
    ServiceFieldModule,
    AuthModule,
    ComplaintsModule,
    ViolationsModule,
    FacilitiesModule,
    BookingsModule,
    ResidentModule,
    PendingRegistrationsModule,
    EventsModule,
    IncidentsModule,
    ReferralsModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
