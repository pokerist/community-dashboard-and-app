import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../../../prisma/prisma.service'; 

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaService, // Provide Prisma to the UsersService
  ],
})
export class UsersModule {}