import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module'
import { ComplaintsModule } from './modules/complaints/complaints.module';
@Module({
  imports: [
    PrismaModule,
    InvoicesModule,
    ComplaintsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
