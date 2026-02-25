import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SystemSettingsService } from './system-settings.service';

@ApiTags('mobile')
@Controller('mobile')
export class MobileAppConfigController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('app-config')
  @ApiOperation({ summary: 'Get public mobile app branding/config' })
  getMobileAppConfig(@Req() req: Request) {
    const protoHeader = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
    const protocol = protoHeader || req.protocol || 'http';
    const host = req.get('host') || '';
    const baseUrl = host ? `${protocol}://${host}` : undefined;
    return this.systemSettingsService.getMobileAppConfig(baseUrl);
  }
}

