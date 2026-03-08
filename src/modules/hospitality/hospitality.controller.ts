import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { HospitalityService, type HospitalityStatusResponse } from './hospitality.service';

@ApiTags('Hospitality')
@Controller('hospitality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get('status')
  @Permissions('hospitality.view')
  getStatus(): HospitalityStatusResponse {
    return this.hospitalityService.getStatus();
  }
}
