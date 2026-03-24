import {
  Injectable, Inject, BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';
import { ResourcesService } from '../resources/resources.service';

@Injectable()
export class UnitsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    @InjectQueue('training') private readonly trainQueue: Queue,
    private readonly config: ConfigService,
    private readonly resourcesService: ResourcesService,
  ) {}

  async getUnits(settlementId: string) {
    const [units, queue] = await Promise.all([
      this.db.query(
        `SELECT * FROM settlement_units WHERE settlement_id = $1`,
        [settlementId],
      ),
      this.db.query(
        `SELECT * FROM training_queues
         WHERE settlement_id = $1 AND status IN ('pending','in_progress')
         ORDER BY position ASC`,
        [settlementId],
      ),
    ]);
    return { units: units.rows, queue: queue.rows };
  }

  async trainUnits(settlementId: string, unitType: string, quantity: number) {
    if (quantity < 1 || quantity > 10000) {
      throw new BadRequestException('Количество: 1–10000');
    }

    const gc = this.config.get('game');
    const unitCfg = gc.units[unitType];
    if (!unitCfg) throw new BadRequestException('Неизвестный тип войска');

    // Check building requirements
    if (unitCfg.requires) {
      for (const [reqType, reqLevel] of Object.entries(unitCfg.requires)) {
        const req = await this.db.query(
          `SELECT level FROM settlement_buildings
           WHERE settlement_id = $1 AND building_type = $2 AND status = 'active'`,
          [settlementId, reqType],
        );
        if (!req.rows.length || req.rows[0].level < (reqLevel as number)) {
          throw new BadRequestException(
            `Требуется ${reqType} уровень ${reqLevel}`,
          );
        }
      }
    }

    // Check population limit
    const settlement = await this.db.query(
      `SELECT s.population, s.population_limit,
              COALESCE(SUM(su.quantity), 0) as total_units
       FROM settlements s
       LEFT JOIN settlement_units su ON su.settlement_id = s.id
       WHERE s.id = $1
       GROUP BY s.id`,
      [settlementId],
    );
    const pop = settlement.rows[0];
    const usedPop = parseInt(pop.total_units) * 1; // simplified: 1 pop per unit
    const availPop = pop.population_limit - usedPop;

    if (quantity * (unitCfg.population || 1) > availPop) {
      throw new BadRequestException(
        `Недостаточно населения. Доступно: ${Math.floor(availPop / (unitCfg.population || 1))}`,
      );
    }

    // Calculate total cost
    const cost = {
      wood:   (unitCfg.cost.wood   || 0) * quantity,
      iron:   (unitCfg.cost.iron   || 0) * quantity,
      food:   (unitCfg.cost.food   || 0) * quantity,
      silver: (unitCfg.cost.silver || 0) * quantity,
    };

    // Check resources
    const hasRes = await this.resourcesService.hasEnoughResources(settlementId, cost);
    if (!hasRes) throw new BadRequestException('Недостаточно ресурсов');

    // Get world train speed
    const speedResult = await this.db.query(
      `SELECT wc.train_speed FROM world_configs wc
       JOIN worlds w ON w.id = wc.world_id
       JOIN settlements s ON s.world_id = w.id
       WHERE s.id = $1`,
      [settlementId],
    );
    const trainSpeed = parseFloat(speedResult.rows[0]?.train_speed || '1.0');

    // Barracks level bonus to train speed
    const barracks = await this.db.query(
      `SELECT level FROM settlement_buildings
       WHERE settlement_id = $1 AND building_type = 'barracks'`,
      [settlementId],
    );
    const barrackBonus = 1 + (barracks.rows[0]?.level || 0) * 0.02;

    const duration = Math.ceil(
      (unitCfg.train_time * quantity) / (trainSpeed * barrackBonus),
    );

    // Deduct resources
    await this.resourcesService.deductResources(settlementId, cost);

    // Get queue position and start time
    const posResult = await this.db.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM training_queues
       WHERE settlement_id = $1 AND status IN ('pending','in_progress')`,
      [settlementId],
    );
    const position = posResult.rows[0].next_pos;

    const lastJob = await this.db.query(
      `SELECT completes_at FROM training_queues
       WHERE settlement_id = $1 AND status = 'in_progress'
       ORDER BY completes_at DESC LIMIT 1`,
      [settlementId],
    );

    const startsAt = lastJob.rows.length
      ? new Date(lastJob.rows[0].completes_at)
      : new Date();
    const completesAt = new Date(startsAt.getTime() + duration * 1000);
    const status = lastJob.rows.length === 0 ? 'in_progress' : 'pending';

    const queueResult = await this.db.query(
      `INSERT INTO training_queues
         (settlement_id, unit_type, quantity, status, position,
          cost_wood, cost_iron, cost_food, cost_silver,
          duration_seconds, starts_at, completes_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        settlementId, unitType, quantity, status, position,
        cost.wood || 0, cost.iron || 0, cost.food || 0, cost.silver || 0,
        duration, startsAt, completesAt,
      ],
    );

    const delay = completesAt.getTime() - Date.now();
    await this.trainQueue.add(
      'complete-training',
      { queueId: queueResult.rows[0].id, settlementId, unitType, quantity },
      { delay: Math.max(delay, 0), jobId: `train-${queueResult.rows[0].id}` },
    );

    return queueResult.rows[0];
  }

  async completeTraining(queueId: string, settlementId: string, unitType: string, quantity: number) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Add units to settlement
      await client.query(
        `INSERT INTO settlement_units (settlement_id, unit_type, quantity, in_garrison)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (settlement_id, unit_type)
         DO UPDATE SET
           quantity = settlement_units.quantity + $3,
           in_garrison = settlement_units.in_garrison + $3,
           updated_at = NOW()`,
        [settlementId, unitType, quantity],
      );

      // Mark queue complete
      await client.query(
        `UPDATE training_queues SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [queueId],
      );

      // Activate next pending
      const nextJob = await client.query(
        `SELECT * FROM training_queues
         WHERE settlement_id = $1 AND status = 'pending'
         ORDER BY position ASC LIMIT 1`,
        [settlementId],
      );
      if (nextJob.rows.length) {
        const next = nextJob.rows[0];
        const now = new Date();
        const completesAt = new Date(now.getTime() + next.duration_seconds * 1000);
        await client.query(
          `UPDATE training_queues SET status = 'in_progress', starts_at = $1, completes_at = $2
           WHERE id = $3`,
          [now, completesAt, next.id],
        );
      }

      await client.query('COMMIT');

      // Notification
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         SELECT s.owner_id, 'training_complete', $2, $3, $4
         FROM settlements s WHERE s.id = $1`,
        [
          settlementId,
          `Обучение завершено`,
          `${quantity} × ${unitType} готовы к бою`,
          JSON.stringify({ unitType, quantity }),
        ],
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  getUnitInfo(unitType: string) {
    const gc = this.config.get('game');
    const cfg = gc.units[unitType];
    if (!cfg) throw new BadRequestException('Неизвестный тип войска');
    return { unitType, ...cfg };
  }

  getAllUnitsInfo() {
    const gc = this.config.get('game');
    return Object.entries(gc.units).map(([type, cfg]: any) => ({
      unitType: type, ...cfg,
    }));
  }
}
