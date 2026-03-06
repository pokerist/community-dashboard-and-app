import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { BlueCollarController } from './blue-collar.controller';
import { BlueCollarService } from './blue-collar.service';
import { ContractorsController } from './contractors.controller';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [PrismaModule, AuthModule, AccessControlModule],
  controllers: [WorkersController, ContractorsController, BlueCollarController],
  providers: [WorkersService, BlueCollarService],
  exports: [WorkersService, BlueCollarService],
})
export class WorkersModule {}

