import {
  Injectable, Inject, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';
import { ResourcesService } from '../resources/resources.service';

@Injectable()
export class BuildingsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    @InjectQueue('buildings') private readonly buildQueue: Queue,
    private readonly config: ConfigService,
    private readonly resourcesService: ResourcesService,
  ) {}

  async getBuildings(settlementId: string) {
    const [buildings, queue] = await Promise.all([
      this.db.query(
        `SELECT * FROM settlement_buildings WHERE settlement_id = $1 ORDER BY building_type`,
        [settlementId],
      ),
      this.db.query(
        `SELECT * FROM building_queues
         WHERE settlement_id = $1 AND status IN ('pending','in_progress')
         ORDER BY position ASC`,
        [settlementId],
      ),
    ]);
    return { buildings: buildings.rows, queue: queue.rows };
  }

  async startUpgrade(settlementId: string, buildingType: string) {
    const gc = this.config.get('game');
    const buildingCfg = gc.buildings[buildingType];
    if (!buildingCfg) throw new BadRequestException('Неизвестный тип здания');

    // Get current building level
    let building = await this.db.query(
      `SELECT * FROM settlement_buildings WHERE settlement_id = $1 AND building_type = $2`,
      [settlementId, buildingType],
    );

    const currentLevel = building.rows[0]?.level ?? 0;
    const targetLevel = currentLevel + 1;

    if (targetLevel > buildingCfg.maxLevel) {
      throw new BadRequestException('Здание уже на максимальном уровне');
    }

    // Check requirements
    if (buildingCfg.requires) {
      for (const [reqType, reqLevel] of Object.entries(buildingCfg.requires)) {
        const req = await this.db.query(
          `SELECT level FROM settlement_buildings WHERE settlement_id = $1 AND building_type = $2`,
          [settlementId, reqType],
        );
        if (!req.rows.length || req.rows[0].level < (reqLevel as number)) {
          throw new BadRequestException(
            `Требуется ${reqType} уровень ${reqLevel}`,
          );
        }
      }
    }

    // Check queue slots (max 2 for now, premium gets more later)
    const queueCount = await this.db.query(
      `SELECT COUNT(*) FROM building_queues
       WHERE settlement_id = $1 AND status IN ('pending','in_progress')`,
      [settlementId],
    );
    if (parseInt(queueCount.rows[0].count) >= 2) {
      throw new BadRequestException('Очередь строительства заполнена (макс. 2)');
    }

    // Calculate cost
    const cost = this.calculateCost(buildingCfg, targetLevel);

    // Get world build speed
    const speedResult = await this.db.query(
      `SELECT wc.build_speed FROM world_configs wc
       JOIN worlds w ON w.id = wc.world_id
       JOIN settlements s ON s.world_id = w.id
       WHERE s.id = $1`,
      [settlementId],
    );
    const buildSpeed = parseFloat(speedResult.rows[0]?.build_speed || '1.0');

    // Calculate duration
    const duration = Math.ceil(
      (buildingCfg.timeBase * Math.pow(buildingCfg.timeMultiplier, targetLevel - 1)) / buildSpeed
    );

    // Check resources
    const hasRes = await this.resourcesService.hasEnoughResources(settlementId, cost);
    if (!hasRes) throw new BadRequestException('Недостаточно ресурсов');

    // Deduct resources
    await this.resourcesService.deductResources(settlementId, cost);

    // Get queue position
    const posResult = await this.db.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM building_queues
       WHERE settlement_id = $1 AND status IN ('pending','in_progress')`,
      [settlementId],
    );
    const position = posResult.rows[0].next_pos;

    // Determine start time (after current in-progress job completes)
    const lastInProgress = await this.db.query(
      `SELECT completes_at FROM building_queues
       WHERE settlement_id = $1 AND status = 'in_progress'
       ORDER BY completes_at DESC LIMIT 1`,
      [settlementId],
    );

    const startsAt = lastInProgress.rows.length
      ? new Date(lastInProgress.rows[0].completes_at)
      : new Date();
    const completesAt = new Date(startsAt.getTime() + duration * 1000);

    // If no active job, this is in_progress immediately
    const status = lastInProgress.rows.length === 0 ? 'in_progress' : 'pending';

    // Insert queue entry
    const queueResult = await this.db.query(
      `INSERT INTO building_queues
         (settlement_id, building_type, from_level, to_level, status, position,
          cost_wood, cost_stone, cost_iron, cost_food, cost_silver,
          duration_seconds, starts_at, completes_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        settlementId, buildingType, currentLevel, targetLevel, status, position,
        cost.wood || 0, cost.stone || 0, cost.iron || 0, cost.food || 0, cost.silver || 0,
        duration, startsAt, completesAt,
      ],
    );

    // If building doesn't exist yet, create it at level 0
    if (!building.rows.length) {
      await this.db.query(
        `INSERT INTO settlement_buildings (settlement_id, building_type, level)
         VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
        [settlementId, buildingType],
      );
    }

    // Schedule BullMQ job
    const delay = completesAt.getTime() - Date.now();
    await this.buildQueue.add(
      'complete-building',
      { queueId: queueResult.rows[0].id, settlementId, buildingType, targetLevel },
      { delay: Math.max(delay, 0), jobId: `build-${queueResult.rows[0].id}` },
    );

    return queueResult.rows[0];
  }

  async cancelUpgrade(queueId: string, settlementId: string) {
    const queue = await this.db.query(
      `SELECT * FROM building_queues WHERE id = $1 AND settlement_id = $2 AND status = 'pending'`,
      [queueId, settlementId],
    );
    if (!queue.rows.length) throw new BadRequestException('Нельзя отменить');

    const q = queue.rows[0];

    // Refund 50% of resources
    await this.resourcesService.deductResources(settlementId, {
      wood:   -(q.cost_wood * 0.5),
      stone:  -(q.cost_stone * 0.5),
      iron:   -(q.cost_iron * 0.5),
      food:   -(q.cost_food * 0.5),
      silver: -(q.cost_silver * 0.5),
    });

    await this.db.query(
      `UPDATE building_queues SET status = 'cancelled' WHERE id = $1`,
      [queueId],
    );

    return { success: true, refunded: true };
  }

  // Called by BullMQ job when building completes
  async completeBuilding(queueId: string, settlementId: string, buildingType: string, targetLevel: number) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Update building level
      await client.query(
        `INSERT INTO settlement_buildings (settlement_id, building_type, level, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (settlement_id, building_type)
         DO UPDATE SET level = $3, status = 'active', updated_at = NOW()`,
        [settlementId, buildingType, targetLevel],
      );

      // Mark queue entry as completed
      await client.query(
        `UPDATE building_queues SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [queueId],
      );

      // Activate next pending job if any
      const nextJob = await client.query(
        `SELECT * FROM building_queues
         WHERE settlement_id = $1 AND status = 'pending'
         ORDER BY position ASC LIMIT 1`,
        [settlementId],
      );

      if (nextJob.rows.length) {
        const next = nextJob.rows[0];
        const now = new Date();
        const completesAt = new Date(now.getTime() + next.duration_seconds * 1000);
        await client.query(
          `UPDATE building_queues SET status = 'in_progress', starts_at = $1, completes_at = $2
           WHERE id = $3`,
          [now, completesAt, next.id],
        );
      }

      await client.query('COMMIT');

      // Recalculate production rates
      await this.resourcesService.recalcProductionRates(settlementId);

      // Create notification
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         SELECT s.owner_id, 'building_complete', $2, $3, $4
         FROM settlements s WHERE s.id = $1`,
        [
          settlementId,
          `${buildingType} улучшено!`,
          `Уровень ${targetLevel} достигнут`,
          JSON.stringify({ buildingType, level: targetLevel }),
        ],
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  private calculateCost(cfg: any, level: number) {
    const mult = Math.pow(cfg.costMultiplier, level - 1);
    return {
      wood:   Math.floor((cfg.baseCost.wood   || 0) * mult),
      stone:  Math.floor((cfg.baseCost.stone  || 0) * mult),
      iron:   Math.floor((cfg.baseCost.iron   || 0) * mult),
      food:   Math.floor((cfg.baseCost.food   || 0) * mult),
      silver: Math.floor((cfg.baseCost.silver || 0) * mult),
    };
  }

  getBuildingCost(buildingType: string, currentLevel: number) {
    const gc = this.config.get('game');
    const cfg = gc.buildings[buildingType];
    if (!cfg) throw new NotFoundException('Здание не найдено');
    return {
      buildingType,
      currentLevel,
      targetLevel: currentLevel + 1,
      cost: this.calculateCost(cfg, currentLevel + 1),
      duration: Math.ceil(cfg.timeBase * Math.pow(cfg.timeMultiplier, currentLevel)),
      maxLevel: cfg.maxLevel,
    };
  }
}
