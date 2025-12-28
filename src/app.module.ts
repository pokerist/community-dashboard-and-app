import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FileModule } from './modules/file/file.module';
import { ServiceRequestModule } from './modules/service-request/service-request.module';
import { ServiceModule } from './modules/service/service.module';
import { ServiceFieldModule } from './modules/service-field/service-field.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { ViolationsModule } from './modules/violations/violations.module';

@Module({
  imports: [
    PrismaModule,
    InvoicesModule,
    EventEmitterModule.forRoot(),
    FileModule,
    ServiceRequestModule,
    ServiceModule,
    ServiceFieldModule,
    AuthModule,
    ComplaintsModule,
    ViolationsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
