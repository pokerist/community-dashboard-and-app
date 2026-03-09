import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ClustersController } from './clusters.controller';
import { ClustersService } from './clusters.service';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { PhasesController } from './phases.controller';
import { PhasesService } from './phases.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommunitiesController, PhasesController, ClustersController],
  providers: [CommunitiesService, PhasesService, ClustersService],
  exports: [CommunitiesService, PhasesService, ClustersService],
})
export class CommunitiesModule {}
