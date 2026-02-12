import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { ContractorsController } from './contractors.controller';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [PrismaModule, AuthModule, AccessControlModule],
  controllers: [WorkersController, ContractorsController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}

