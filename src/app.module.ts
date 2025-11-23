import { Module } from '@nestjs/common';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [InvoicesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
