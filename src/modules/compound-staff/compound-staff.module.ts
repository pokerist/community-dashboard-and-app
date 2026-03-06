import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompoundStaffController } from './compound-staff.controller';
import { CompoundStaffService } from './compound-staff.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompoundStaffController],
  providers: [CompoundStaffService],
  exports: [CompoundStaffService],
})
export class CompoundStaffModule {}
