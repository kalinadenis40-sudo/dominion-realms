import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { MovementsService } from './movements.service';
import { CombatService } from '../combat/combat.service';

@Processor('movements')
export class MovementsJob {
  private readonly logger = new Logger('MovementsJob');

  constructor(
    private readonly movementsService: MovementsService,
    private readonly combatService: CombatService,
  ) {}

  @Process('movement-arrive')
  async handleArrival(job: Job) {
    const { movementId, type } = job.data;
    try {
      const result = await this.movementsService.handleArrival(movementId, type);
      if (result?.needsCombat) {
        await this.combatService.processCombat(movementId);
      }
      this.logger.log(`Movement arrived: ${movementId} (${type})`);
    } catch (err) {
      this.logger.error(`Movement arrival failed: ${err.message}`);
      throw err;
    }
  }

  @Process('movement-return')
  async handleReturn(job: Job) {
    const { movementId } = job.data;
    try {
      await this.movementsService.handleReturn(movementId);
      this.logger.log(`Movement returned: ${movementId}`);
    } catch (err) {
      this.logger.error(`Movement return failed: ${err.message}`);
      throw err;
    }
  }
}
