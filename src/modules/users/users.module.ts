import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './users.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService], // Export for use in other modules
})
export class UsersModule {}
