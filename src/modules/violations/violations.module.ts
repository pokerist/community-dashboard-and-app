// src/modules/violations/violations.module.ts
import { Module } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module'; // <--- IMPORT THIS

@Module({
  imports: [PrismaModule, InvoicesModule], // <--- ADD TO IMPORTS
  controllers: [ViolationsController],
  providers: [ViolationsService],
})
export class ViolationsModule {}