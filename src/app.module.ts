import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module'
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FileModule } from './modules/file/file.module';

@Module({
  imports: [
    PrismaModule,
    InvoicesModule,
    EventEmitterModule.forRoot(),
    FileModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
