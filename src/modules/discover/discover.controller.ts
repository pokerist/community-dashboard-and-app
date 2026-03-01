import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiscoverService } from './discover.service';
import { UpsertDiscoverPlaceDto } from './dto/discover.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  @Get()
  @ApiOperation({ summary: 'Public/mobile list of active discover places' })
  listPublic() {
    return this.discoverService.listPublic();
  }

  @Get('admin')
  @ApiOperation({ summary: 'Admin list of discover places' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.view')
  listAdmin() {
    return this.discoverService.listAdmin();
  }

  @Post('admin')
  @ApiOperation({ summary: 'Admin create discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  create(@Body() dto: UpsertDiscoverPlaceDto) {
    return this.discoverService.create(dto);
  }

  @Patch('admin/:id')
  @ApiOperation({ summary: 'Admin update discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  update(@Param('id') id: string, @Body() dto: UpsertDiscoverPlaceDto) {
    return this.discoverService.update(id, dto);
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Admin delete discover place' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  remove(@Param('id') id: string) {
    return this.discoverService.remove(id);
  }
}
