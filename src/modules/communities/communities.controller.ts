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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@ApiTags('communities')
@Controller('communities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get()
  @Permissions('unit.view_all', 'admin.view')
  findAll() {
    return this.communitiesService.findAll();
  }

  @Get(':id/detail')
  @Permissions('unit.view_all', 'admin.view')
  getCommunityDetail(@Param('id') id: string) {
    return this.communitiesService.getCommunityDetail(id);
  }

  @Get(':id/stats')
  @Permissions('unit.view_all', 'admin.view')
  getCommunityStats(@Param('id') id: string) {
    return this.communitiesService.getCommunityStats(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('unit.create', 'admin.update')
  create(@Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(dto);
  }

  @Patch(':id')
  @Permissions('unit.update', 'admin.update')
  update(@Param('id') id: string, @Body() dto: UpdateCommunityDto) {
    return this.communitiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('unit.delete', 'admin.update')
  remove(@Param('id') id: string) {
    return this.communitiesService.remove(id);
  }
}
