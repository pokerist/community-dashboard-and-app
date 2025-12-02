import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module'
import { ViolationsModule } from './modules/violations/violations.module';

@Module({
  imports: [
    PrismaModule,
    InvoicesModule, ViolationsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
