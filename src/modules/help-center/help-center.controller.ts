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
import { HelpCenterService } from './help-center.service';
import { UpsertHelpCenterEntryDto } from './dto/help-center.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Help Center')
@Controller('help-center')
export class HelpCenterController {
  constructor(private readonly helpCenterService: HelpCenterService) {}

  @Get()
  @ApiOperation({ summary: 'Public/mobile list of active help center contacts' })
  listPublic() {
    return this.helpCenterService.listPublic();
  }

  @Get('admin')
  @ApiOperation({ summary: 'Admin list of help center contacts' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.view')
  listAdmin() {
    return this.helpCenterService.listAdmin();
  }

  @Post('admin')
  @ApiOperation({ summary: 'Admin create help center contact' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  create(@Body() dto: UpsertHelpCenterEntryDto) {
    return this.helpCenterService.create(dto);
  }

  @Patch('admin/:id')
  @ApiOperation({ summary: 'Admin update help center contact' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  update(@Param('id') id: string, @Body() dto: UpsertHelpCenterEntryDto) {
    return this.helpCenterService.update(id, dto);
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Admin delete help center contact' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.update')
  remove(@Param('id') id: string) {
    return this.helpCenterService.remove(id);
  }
}
