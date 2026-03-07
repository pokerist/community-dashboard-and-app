import { Controller, Get } from '@nestjs/common';
import { HospitalityService, type HospitalityStatusResponse } from './hospitality.service';

@Controller('hospitality')
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get('status')
  getStatus(): HospitalityStatusResponse {
    return this.hospitalityService.getStatus();
  }
}
