import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoiceCategoryService } from './invoice-categories.service';
import { InvoiceCategoriesController } from './invoice-categories.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [InvoicesService, InvoiceCategoryService],
  controllers: [InvoicesController, InvoiceCategoriesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
