import { Module } from '@nestjs/common';
import { UsersService } from './residents.service';
import { UsersController } from './residents.controller';
import { PrismaService } from '../../../prisma/prisma.service'; 

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaService, // Provide Prisma to the UsersService
  ],
})
export class UsersModule {}