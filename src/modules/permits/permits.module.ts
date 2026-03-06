import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PermitTypesController } from './permit-types.controller';
import { PermitsController } from './permits.controller';
import { PermitsService } from './permits.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PermitTypesController, PermitsController],
  providers: [PermitsService],
  exports: [PermitsService],
})
export class PermitsModule {}
