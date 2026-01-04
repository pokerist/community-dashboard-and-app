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

@Module({
  imports: [
    PrismaModule,
    InvoicesModule,
    UnitsModule,
    InvoicesModule,
    EventEmitterModule.forRoot(),
    FileModule,
    ServiceRequestModule,
    ServiceModule,
    ServiceFieldModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
