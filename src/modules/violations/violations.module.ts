// src/modules/violations/violations.module.ts
import { Module } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { InvoicesService } from '../invoices/invoices.service';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [ViolationsController],
  providers: [InvoicesService, ViolationsService],
})
export class ViolationsModule {}