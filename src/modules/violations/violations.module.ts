// src/modules/violations/violations.module.ts
import { Module } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AuthModule } from '../auth/auth.module';
import { ViolationCategoriesController } from './violation-categories.controller';
import { ViolationCategoriesService } from './violation-categories.service';

@Module({
  imports: [PrismaModule, InvoicesModule, AuthModule],
  controllers: [ViolationsController, ViolationCategoriesController],
  providers: [ViolationsService, ViolationCategoriesService],
})
export class ViolationsModule {}
