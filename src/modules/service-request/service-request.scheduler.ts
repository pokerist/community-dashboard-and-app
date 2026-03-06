import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ServiceRequestService } from './service-request.service';

@Injectable()
export class ServiceRequestScheduler {
  private readonly logger = new Logger(ServiceRequestScheduler.name);

  constructor(private readonly serviceRequestService: ServiceRequestService) {}

  @Cron('0 */15 * * * *')
  async handleSlaBreachScan(): Promise<void> {
    const count = await this.serviceRequestService.checkSlaBreaches();
    if (count > 0) {
      this.logger.warn(`Marked ${count} service request(s) as SLA breached.`);
    }
  }
}
