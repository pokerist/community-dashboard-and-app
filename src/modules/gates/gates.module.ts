import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommunityGatesController } from './community-gates.controller';
import { GatesController } from './gates.controller';
import { GatesService } from './gates.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GatesController, CommunityGatesController],
  providers: [GatesService],
  exports: [GatesService],
})
export class GatesModule {}

