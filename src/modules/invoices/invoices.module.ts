import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [InvoicesService],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
