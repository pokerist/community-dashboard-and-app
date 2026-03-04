import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessControlService } from './access-control.service';

@Injectable()
export class AccessControlScheduler {
  private readonly logger = new Logger(AccessControlScheduler.name);

  constructor(private readonly accessControlService: AccessControlService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOverdueExitScan() {
    try {
      const result = await this.accessControlService.processOverdueExits();
      if (result.processed > 0) {
        this.logger.log(`Processed ${result.processed} overdue gate exits`);
      }
    } catch (error) {
      this.logger.error('Failed to process overdue gate exits', error as any);
    }
  }
}
