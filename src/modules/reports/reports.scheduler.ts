import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsScheduler {
  private readonly logger = new Logger(ReportsScheduler.name);
  private isRunning = false;

  constructor(private readonly reportsService: ReportsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueSchedules() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const result = await this.reportsService.processDueSchedules();
      if (result.processedCount > 0) {
        this.logger.log(
          `Processed ${result.processedCount} due report schedules (${result.successCount} ok, ${result.failedCount} failed)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to process due report schedules',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}

