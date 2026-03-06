import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ClustersService } from './clusters.service';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { ReorderClustersDto } from './dto/reorder-clusters.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';

@ApiTags('communities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  @Get('communities/:communityId/clusters')
  @Permissions('unit.view_all', 'admin.view')
  listClusters(@Param('communityId') communityId: string) {
    return this.clustersService.listClusters(communityId);
  }

  @Post('communities/:communityId/clusters')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('unit.create', 'unit.update', 'admin.update')
  createCluster(
    @Param('communityId') communityId: string,
    @Body() dto: CreateClusterDto,
  ) {
    return this.clustersService.createCluster(communityId, dto);
  }

  @Patch('communities/:communityId/clusters/reorder')
  @Permissions('unit.update', 'admin.update')
  reorderClusters(
    @Param('communityId') communityId: string,
    @Body() dto: ReorderClustersDto,
  ) {
    return this.clustersService.reorderClusters(communityId, dto);
  }

  @Patch('clusters/:id')
  @Permissions('unit.update', 'admin.update')
  updateCluster(@Param('id') id: string, @Body() dto: UpdateClusterDto) {
    return this.clustersService.updateCluster(id, dto);
  }

  @Delete('clusters/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.delete', 'admin.update')
  deleteCluster(@Param('id') id: string) {
    return this.clustersService.deleteCluster(id);
  }
}

