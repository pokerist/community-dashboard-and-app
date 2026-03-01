import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { UsersModule } from './modules/users/users.module';
import { PendingRegistrationsModule } from './modules/pending-registrations/pending-registrations.module';
import { EventsModule } from './events/events.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LeasesModule } from './modules/leases/leases.module';
import { OwnersModule } from './modules/owners/owners.module';
import { DelegatesModule } from './modules/delegates/delegates.module';
import { ClubhouseModule } from './modules/clubhouse/clubhouse.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { WorkersModule } from './modules/workers/workers.module';
import { BannersModule } from './modules/banners/banners.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FireEvacuationModule } from './modules/fire-evacuation/fire-evacuation.module';
import { ResidentVehiclesModule } from './modules/resident-vehicles/resident-vehicles.module';
import { HelpCenterModule } from './modules/help-center/help-center.module';
import { DiscoverModule } from './modules/discover/discover.module';
import { HouseholdModule } from './modules/household/household.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    InvoicesModule,
    UnitsModule,
    EventEmitterModule.forRoot(),
    FileModule,
    ServiceRequestModule,
    ServiceModule,
    ServiceFieldModule,
    ComplaintsModule,
    ViolationsModule,
    FacilitiesModule,
    BookingsModule,
    UsersModule,
    PendingRegistrationsModule,
    EventsModule,
    IncidentsModule,
    ReferralsModule,
    NotificationsModule,
    DashboardModule,
    LeasesModule,
    OwnersModule,
    DelegatesModule,
    ClubhouseModule,
    AccessControlModule,
    WorkersModule,
    BannersModule,
    SystemSettingsModule,
    ReportsModule,
    FireEvacuationModule,
    ResidentVehiclesModule,
    HelpCenterModule,
    DiscoverModule,
    HouseholdModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
