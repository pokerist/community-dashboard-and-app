import { Module } from '@nestjs/common';
import { ResidentService } from './residents.service';
import { AdminUsersController } from './residents.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [ResidentService, PrismaService],
  exports: [ResidentService], // Export for use in other modules
})
export class ResidentModule {}
