import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { UpdateBannerStatusDto } from './dto/update-banner-status.dto';
import { ListBannersDto } from './dto/list-banners.dto';

@ApiTags('banners')
@Controller('banners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  @Permissions('banner.manage')
  @ApiOperation({ summary: 'Create banner' })
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Get()
  @Permissions('banner.view', 'banner.manage')
  @ApiOperation({ summary: 'List banners' })
  findAll(@Query() query: ListBannersDto) {
    return this.bannersService.findAll(query);
  }

  @Get('mobile')
  @Permissions('banner.view', 'banner.manage')
  @ApiOperation({
    summary:
      'List active banners for mobile app (date-valid and audience-filtered)',
  })
  findMobile(@Request() req: any, @Query('unitId') unitId?: string) {
    return this.bannersService.findMobileForUser(req.user.id, { unitId });
  }

  @Get('mobile-feed')
  @Permissions('banner.view', 'banner.manage')
  @ApiOperation({
    summary:
      'Alias for mobile banner feed (prevents route conflicts with /banners/:id)',
  })
  findMobileFeed(@Request() req: any, @Query('unitId') unitId?: string) {
    return this.bannersService.findMobileForUser(req.user.id, { unitId });
  }

  @Get(':id([0-9a-fA-F-]{36})')
  @Permissions('banner.view', 'banner.manage')
  @ApiOperation({ summary: 'Get banner by id' })
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id([0-9a-fA-F-]{36})/status')
  @Permissions('banner.manage')
  @ApiOperation({ summary: 'Update banner status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBannerStatusDto) {
    return this.bannersService.updateStatus(id, dto.status);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @Permissions('banner.manage')
  @ApiOperation({ summary: 'Update banner' })
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @Permissions('banner.manage')
  @ApiOperation({ summary: 'Delete banner' })
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
