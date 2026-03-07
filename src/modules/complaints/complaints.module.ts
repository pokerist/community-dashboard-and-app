import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { ComplaintCategoriesController } from './complaint-categories.controller';
import { ComplaintCategoriesService } from './complaint-categories.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  controllers: [ComplaintsController, ComplaintCategoriesController],
  providers: [ComplaintsService, ComplaintCategoriesService, PrismaService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
