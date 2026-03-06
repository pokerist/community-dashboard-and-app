import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ClustersController } from './clusters.controller';
import { ClustersService } from './clusters.service';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommunitiesController, ClustersController],
  providers: [CommunitiesService, ClustersService],
  exports: [CommunitiesService, ClustersService],
})
export class CommunitiesModule {}
