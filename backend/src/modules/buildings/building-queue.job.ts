import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { BuildingsService } from './buildings.service';

@Processor('buildings')
export class BuildingQueueJob {
  private readonly logger = new Logger('BuildingQueue');

  constructor(private readonly buildingsService: BuildingsService) {}

  @Process('complete-building')
  async handleBuildingComplete(job: Job) {
    const { queueId, settlementId, buildingType, targetLevel } = job.data;
    try {
      await this.buildingsService.completeBuilding(queueId, settlementId, buildingType, targetLevel);
      this.logger.log(`Building completed: ${buildingType} lv${targetLevel} in ${settlementId}`);
    } catch (err) {
      this.logger.error(`Building job failed: ${err.message}`, err.stack);
      throw err;
    }
  }
}
