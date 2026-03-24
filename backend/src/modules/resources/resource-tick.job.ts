import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ResourcesService } from './resources.service';

@Injectable()
export class ResourceTickJob {
  private readonly logger = new Logger('ResourceTick');

  constructor(private readonly resourcesService: ResourcesService) {}

  // Every minute — tick resources for all settlements
  @Cron(CronExpression.EVERY_MINUTE)
  async handleResourceTick() {
    try {
      await this.resourcesService.tickAllSettlements();
    } catch (err) {
      this.logger.error('Resource tick failed', err);
    }
  }
}
