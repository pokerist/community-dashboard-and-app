import {
  Body,
  Controller,
  Get,
  Param,
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
import { IntegrationConfigService } from './integration-config.service';
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
  UpdateMobileAccessSettingsDto,
  UpdateOnboardingSettingsDto,
  UpdateOffersSettingsDto,
  UpdateSecuritySettingsDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  ListDepartmentsDto,
  CreateSystemUserDto,
  UpdateSystemUserDto,
  ListSystemUsersDto,
} from './dto/system-settings.dto';

@ApiTags('system-settings')
@Controller('system-settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemSettingsController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  private actorId(req: any): string | null {
    return req?.user?.id ?? null;
  }

  @Get()
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Get system settings (all sections)' })
  getAll() {
    return this.systemSettingsService.getSettings();
  }

  @Get('integrations')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Get integration settings with readiness status' })
  getIntegrations() {
    return this.integrationConfigService.getAdminIntegrations();
  }

  @Patch('integrations/:provider')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update integration provider settings' })
  updateIntegrationProvider(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ) {
    return this.integrationConfigService.updateProvider(
      provider,
      body,
      this.actorId(req),
    );
  }

  @Post('integrations/:provider/test')
  @Permissions('admin.view')
  @ApiOperation({
    summary: 'Test integration provider connectivity/configuration',
  })
  testIntegrationProvider(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationConfigService.testProvider(provider, body);
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
    return this.systemSettingsService.updateNotifications(
      dto,
      this.actorId(req),
    );
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

  @Patch('onboarding')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update mobile onboarding settings section' })
  updateOnboarding(@Body() dto: UpdateOnboardingSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateOnboarding(dto, this.actorId(req));
  }

  @Patch('offers')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update mobile offers banners settings section' })
  updateOffers(@Body() dto: UpdateOffersSettingsDto, @Req() req: any) {
    return this.systemSettingsService.updateOffers(dto, this.actorId(req));
  }

  @Patch('mobile-access')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update mobile feature access policies by persona' })
  updateMobileAccess(
    @Body() dto: UpdateMobileAccessSettingsDto,
    @Req() req: any,
  ) {
    return this.systemSettingsService.updateMobileAccess(
      dto,
      this.actorId(req),
    );
  }

  @Post('crm/test')
  @Permissions('admin.view')
  @ApiOperation({
    summary: 'Test CRM connectivity using provided or saved settings',
  })
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
  @ApiOperation({
    summary: 'Restore system settings from a stored backup snapshot',
  })
  restoreBackup(@Body() dto: RestoreSystemSettingsBackupDto, @Req() req: any) {
    return this.systemSettingsService.restoreBackup(
      dto.backupId,
      this.actorId(req),
    );
  }

  @Post('backup/import')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Import system settings snapshot object (JSON)' })
  importSnapshot(
    @Body() dto: ImportSystemSettingsSnapshotDto,
    @Req() req: any,
  ) {
    return this.systemSettingsService.importSnapshot(dto, this.actorId(req));
  }

  // Departments Management
  @Get('departments')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List all departments' })
  listDepartments(@Query() query: ListDepartmentsDto) {
    return this.systemSettingsService.listDepartments(query);
  }

  @Post('departments')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Create a new department' })
  createDepartment(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.systemSettingsService.createDepartment(dto, this.actorId(req));
  }

  @Patch('departments/:id')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update a department' })
  updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: any,
  ) {
    return this.systemSettingsService.updateDepartment(
      id,
      dto,
      this.actorId(req),
    );
  }

  @Delete('departments/:id')
  @Permissions('admin.update')
  @ApiOperation({
    summary: 'Delete a department (with guards for active assignments)',
  })
  deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.systemSettingsService.deleteDepartment(id, this.actorId(req));
  }

  // System Users Management
  @Get('users')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List all system users' })
  listSystemUsers(@Query() query: ListSystemUsersDto) {
    return this.systemSettingsService.listSystemUsers(query);
  }

  @Post('users')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Create a new system user' })
  createSystemUser(@Body() dto: CreateSystemUserDto, @Req() req: any) {
    return this.systemSettingsService.createSystemUser(dto, this.actorId(req));
  }

  @Patch('users/:id')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update a system user' })
  updateSystemUser(
    @Param('id') id: string,
    @Body() dto: UpdateSystemUserDto,
    @Req() req: any,
  ) {
    return this.systemSettingsService.updateSystemUser(
      id,
      dto,
      this.actorId(req),
    );
  }

  @Delete('users/:id')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Archive/deactivate a system user' })
  deleteSystemUser(@Param('id') id: string, @Req() req: any) {
    return this.systemSettingsService.deactivateSystemUser(
      id,
      this.actorId(req),
    );
  }

  // Roles & Permissions Management
  @Get('roles')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List all dashboard roles with permissions' })
  listRoles() {
    return this.systemSettingsService.listRoles();
  }

  @Post('roles')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Create a new dashboard role' })
  createRole(@Body() dto: any, @Req() req: any) {
    return this.systemSettingsService.createRole(dto, this.actorId(req));
  }

  @Patch('roles/:id')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Update dashboard role permissions' })
  updateRole(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.systemSettingsService.updateRole(id, dto, this.actorId(req));
  }

  @Delete('roles/:id')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Delete dashboard role (with guards)' })
  deleteRole(@Param('id') id: string, @Req() req: any) {
    return this.systemSettingsService.deleteRole(id, this.actorId(req));
  }

  @Get('permissions')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'List all available permissions' })
  listPermissions() {
    return this.systemSettingsService.listPermissions();
  }
}
