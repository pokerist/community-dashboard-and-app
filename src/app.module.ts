import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from '../prisma/prisma.module'
@Module({
  imports: [
    PrismaModule,
    InvoicesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
