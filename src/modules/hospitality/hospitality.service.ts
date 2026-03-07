import { Injectable } from '@nestjs/common';

export type HospitalityStatusResponse = {
  status: 'COMING_SOON';
  message: string;
};

@Injectable()
export class HospitalityService {
  getStatus(): HospitalityStatusResponse {
    return {
      status: 'COMING_SOON',
      message:
        'Hospitality module is under development and will be available in a future release.',
    };
  }
}
