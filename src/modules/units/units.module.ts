import { Module } from '@nestjs/common';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { PrismaService } from '../../../prisma/prisma.service'; // Adjust path as needed

@Module({
  controllers: [UnitsController],
  providers: [
    UnitsService,
    PrismaService 
  ],
})
export class UnitsModule {}