import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SystemSettingsService } from './system-settings.service';
import {
  CreateSystemSettingsBackupDto,
  ImportSystemSettingsSnapshotDto,
  ListSystemSettingsBackupsDto,
  RestoreSystemSettingsBackupDto,
  TestCrmConnectionDto,
  UpdateBrandSettingsDto,
  UpdateBackupSettingsDto,
  UpdateCrmSettingsDto,
  UpdateGeneralSettingsDto,
  UpdateNotificationSettingsDto,
  UpdateSecuritySettingsDto,
} from './dto/system-settings.dto';

@ApiTags('system-settings')
@Controller('system-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  private actorId(req: any): string | null {
    return req?.user?.id ?? null;
  }

  @Get()
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Get system settings (all sections)' })
  getAll() {
    return this.systemSettingsService.getSettings();
  }

  @Patch('general')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update general settings section' })
  updateGeneral(@Body() dto: UpdateGeneralSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateGeneral(dto, this.actorId(req));
  }

  @Patch('notifications')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update notifications settings section' })
  updateNotifications(
    @Body() dto: UpdateNotificationSettingsDto,
    @Req() req: any,
  ) {
    return this.systemSettingsService.updateNotifications(dto, this.actorId(req));
  }

  @Patch('security')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update security settings section' })
  updateSecurity(@Body() dto: UpdateSecuritySettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateSecurity(dto, this.actorId(req));
  }

  @Patch('backup')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update backup settings section' })
  updateBackup(@Body() dto: UpdateBackupSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateBackup(dto, this.actorId(req));
  }

  @Patch('crm')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update CRM settings section' })
  updateCrm(@Body() dto: UpdateCrmSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateCrm(dto, this.actorId(req));
  }

  @Patch('brand')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update brand settings section' })
  updateBrand(@Body() dto: UpdateBrandSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateBrand(dto, this.actorId(req));
  }

  @Post('crm/test')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Test CRM connectivity using provided or saved settings' })
  testCrm(@Body() dto: TestCrmConnectionDto) {
    return this.systemSettingsService.testCrmConnection(dto);
  }

  @Post('backup/create')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Create a system settings backup snapshot' })
  createBackup(@Body() dto: CreateSystemSettingsBackupDto, @Req() req: any) {
    return this.systemSettingsService.createBackup(dto, this.actorId(req));
  }

  @Get('backup/history')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List system settings backup snapshots' })
  listBackups(@Query() query: ListSystemSettingsBackupsDto) {
    return this.systemSettingsService.listBackupHistory(query);
  }

  @Post('backup/restore')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Restore system settings from a stored backup snapshot' })
  restoreBackup(@Body() dto: RestoreSystemSettingsBackupDto, @Req() req: any) {
    return this.systemSettingsService.restoreBackup(dto.backupId, this.actorId(req));
  }

  @Post('backup/import')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Import system settings snapshot object (JSON)' })
  importSnapshot(@Body() dto: ImportSystemSettingsSnapshotDto, @Req() req: any) {
    return this.systemSettingsService.importSnapshot(dto, this.actorId(req));
  }
}
