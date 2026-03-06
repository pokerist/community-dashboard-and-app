import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './users.controller';
import { UsersHubController } from './users-hub.controller';
import { BrokersController } from './brokers.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CompoundStaffModule } from '../compound-staff/compound-staff.module';

@Module({
  imports: [AuthModule, CompoundStaffModule],
  controllers: [AdminUsersController, UsersHubController, BrokersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService], // Export for use in other modules
})
export class UsersModule {}
