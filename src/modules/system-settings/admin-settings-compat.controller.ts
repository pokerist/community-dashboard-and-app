import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { SystemSettingsService } from './system-settings.service';

type AdminSettingsPayload = {
  general?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  security?: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  localization?: Record<string, unknown>;
  authentication?: Record<string, unknown>;
  mobileAccess?: Record<string, unknown>;
};

@ApiTags('admin-settings-compat')
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AdminSettingsCompatController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  private actorId(req: any): string | null {
    return req?.user?.id ?? null;
  }

  @Get('settings')
  @Permissions('admin.view')
  @ApiOperation({ summary: 'Compatibility endpoint for legacy admin settings page' })
  async getSettingsCompat() {
    const settings = await this.systemSettingsService.getSettings();
    const data = settings.data as any;

    return {
      general: {
        companyName: data.general?.companyName ?? '',
        supportEmail: data.brand?.supportEmail ?? '',
        supportPhone: data.brand?.supportPhone ?? '',
        address: '',
        timezone: data.general?.timezone ?? 'Africa/Cairo',
        logoFileId: data.brand?.logoFileId ?? '',
      },
      notifications: {
        emailEnabled: Boolean(data.notifications?.enableEmail),
        pushEnabled: Boolean(data.notifications?.enablePush),
        smsEnabled: Boolean(data.notifications?.enableSms),
        otpEnabled: true,
        maintenanceAlerts: true,
        paymentReminders: true,
        emergencyBroadcast: true,
        digestFrequency: 'daily',
      },
      security: {
        auditLogRetentionDays: 90,
      },
      appearance: {
        primaryColor: data.brand?.primaryColor ?? '#111827',
        accentColor: data.brand?.accentColor ?? '#2563EB',
        logoUrl: '',
        darkMode: false,
        compactLayout: false,
        language: data.general?.defaultLanguage === 'ar' ? 'ar' : 'en',
      },
      localization: {
        defaultLanguage: data.general?.defaultLanguage === 'ar' ? 'ar' : 'en',
        currency: data.general?.currency ?? 'EGP',
        dateFormat: data.general?.dateFormat ?? 'DD/MM/YYYY',
        rtlSupport: false,
        timezone: data.general?.timezone ?? 'Africa/Cairo',
      },
      data: {
        backupEnabled: Boolean(data.backup?.autoBackups),
        backupFrequency: 'daily',
        retentionDays: Number(data.backup?.retentionDays ?? 90),
        exportFormat: 'csv',
        analyticsEnabled: true,
      },
      authentication: {
        require2fa: Boolean(data.security?.enforce2fa),
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false,
        passwordMinLength: Number(data.security?.minPasswordLength ?? 8),
        maxRequestsPerMinute: Number(data.security?.rateLimitPerMinute ?? 60),
        sessionTimeoutMinutes: Number(data.security?.sessionTimeoutMinutes ?? 60),
        maxLoginAttempts: 5,
        registrationType: 'pre-registered',
      },
      mobileAccess: {},
    };
  }

  @Patch('settings')
  @Permissions('admin.update')
  @ApiOperation({ summary: 'Compatibility endpoint for legacy admin settings save' })
  async patchSettingsCompat(@Body() payload: AdminSettingsPayload, @Req() req: any) {
    const actorId = this.actorId(req);

    if (payload.general || payload.localization) {
      await this.systemSettingsService.updateGeneral(
        {
          companyName: (payload.general?.companyName as string | undefined) ?? undefined,
          timezone:
            (payload.general?.timezone as string | undefined) ??
            (payload.localization?.timezone as string | undefined) ??
            undefined,
          currency: (payload.localization?.currency as string | undefined) ?? undefined,
          dateFormat: (payload.localization?.dateFormat as string | undefined) ?? undefined,
          defaultLanguage:
            (payload.localization?.defaultLanguage as string | undefined) ?? undefined,
        },
        actorId,
      );
    }

    if (payload.notifications) {
      await this.systemSettingsService.updateNotifications(
        {
          enableEmail: payload.notifications.emailEnabled as boolean | undefined,
          enablePush: payload.notifications.pushEnabled as boolean | undefined,
          enableSms: payload.notifications.smsEnabled as boolean | undefined,
        },
        actorId,
      );
    }

    if (payload.security || payload.authentication) {
      await this.systemSettingsService.updateSecurity(
        {
          enforce2fa: payload.authentication?.require2fa as boolean | undefined,
          minPasswordLength:
            payload.authentication?.passwordMinLength as number | undefined,
          rateLimitPerMinute:
            payload.authentication?.maxRequestsPerMinute as number | undefined,
          sessionTimeoutMinutes:
            payload.authentication?.sessionTimeoutMinutes as number | undefined,
        },
        actorId,
      );
    }

    if (payload.appearance || payload.general) {
      await this.systemSettingsService.updateBrand(
        {
          companyName: (payload.general?.companyName as string | undefined) ?? undefined,
          supportEmail: (payload.general?.supportEmail as string | undefined) ?? undefined,
          supportPhone: (payload.general?.supportPhone as string | undefined) ?? undefined,
          logoFileId: (payload.general?.logoFileId as string | undefined) ?? undefined,
          primaryColor: (payload.appearance?.primaryColor as string | undefined) ?? undefined,
          accentColor: (payload.appearance?.accentColor as string | undefined) ?? undefined,
        },
        actorId,
      );
    }

    return this.getSettingsCompat();
  }

  @Get('departments')
  @Permissions('admin.view')
  listDepartments(@Query() query: any) {
    return this.systemSettingsService.listDepartments(query);
  }

  @Post('departments')
  @Permissions('admin.update')
  createDepartment(@Body() dto: any, @Req() req: any) {
    return this.systemSettingsService.createDepartment(dto, this.actorId(req));
  }

  @Patch('departments/:id')
  @Permissions('admin.update')
  updateDepartment(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.systemSettingsService.updateDepartment(id, dto, this.actorId(req));
  }

  @Delete('departments/:id')
  @Permissions('admin.update')
  deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.systemSettingsService.deleteDepartment(id, this.actorId(req));
  }

  @Post('backup/trigger')
  @Permissions('admin.update')
  triggerBackup(@Req() req: any) {
    return this.systemSettingsService.createBackup(
      { label: 'Manual admin backup' },
      this.actorId(req),
    );
  }
}
