import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IntegrationConfigService } from './integration-config.service';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('mobile')
@Controller('mobile')
export class MobileAppConfigController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  @Get('app-config')
  @ApiOperation({ summary: 'Get public mobile app branding/config' })
  async getMobileAppConfig(@Req() req: Request) {
    const protoHeader = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
    const protocol = protoHeader || req.protocol || 'http';
    const host = req.get('host') || '';
    const baseUrl = host ? `${protocol}://${host}` : undefined;
    const [config, capabilities] = await Promise.all([
      this.systemSettingsService.getMobileAppConfig(baseUrl),
      this.integrationConfigService.getMobileCapabilities(),
    ]);
    return {
      ...config,
      capabilities,
    };
  }
}
