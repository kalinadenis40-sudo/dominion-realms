import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { UnitsService } from './units.service';

@Processor('training')
export class TrainingQueueJob {
  private readonly logger = new Logger('TrainingQueue');

  constructor(private readonly unitsService: UnitsService) {}

  @Process('complete-training')
  async handleTrainingComplete(job: Job) {
    const { queueId, settlementId, unitType, quantity } = job.data;
    try {
      await this.unitsService.completeTraining(queueId, settlementId, unitType, quantity);
      this.logger.log(`Training completed: ${quantity}x ${unitType} in ${settlementId}`);
    } catch (err) {
      this.logger.error(`Training job failed: ${err.message}`);
      throw err;
    }
  }
}
