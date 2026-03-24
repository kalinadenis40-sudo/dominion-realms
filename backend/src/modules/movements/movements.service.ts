import {
  Injectable, Inject, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';

export type MovementType = 'attack' | 'support' | 'scout' | 'transport' | 'capture' | 'raid' | 'reinforce';

@Injectable()
export class MovementsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    @InjectQueue('movements') private readonly movQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // SEND MOVEMENT
  // ============================================================
  async sendMovement(params: {
    profileId: string;
    originSettlementId: string;
    targetSettlementId: string;
    type: MovementType;
    units: Record<string, number>;
    resources?: Record<string, number>;
  }) {
    const { profileId, originSettlementId, targetSettlementId, type, units, resources } = params;

    // Validate origin belongs to player
    const originResult = await this.db.query(
      `SELECT s.*, t.x as ox, t.y as oy, wc.movement_speed
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       JOIN worlds w ON w.id = s.world_id
       JOIN world_configs wc ON wc.world_id = w.id
       WHERE s.id = $1 AND s.owner_id = $2`,
      [originSettlementId, profileId],
    );
    if (!originResult.rows.length) throw new NotFoundException('Поселение не найдено');
    const origin = originResult.rows[0];

    // Validate target
    const targetResult = await this.db.query(
      `SELECT s.*, t.x as tx, t.y as ty, t.biome,
              s.has_newbie_shield, s.shield_expires_at
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       WHERE s.id = $1`,
      [targetSettlementId],
    );
    if (!targetResult.rows.length) throw new NotFoundException('Цель не найдена');
    const target = targetResult.rows[0];

    // Newbie shield check
    if (target.has_newbie_shield && target.shield_expires_at > new Date() && type === 'attack') {
      throw new BadRequestException('Цель защищена щитом новичка');
    }

    // Validate units exist in origin
    const totalUnits = Object.values(units).reduce((a, b) => a + b, 0);
    if (totalUnits <= 0) throw new BadRequestException('Нет войск для отправки');

    for (const [unitType, qty] of Object.entries(units)) {
      if (!qty || qty <= 0) continue;
      const uResult = await this.db.query(
        `SELECT in_garrison FROM settlement_units
         WHERE settlement_id = $1 AND unit_type = $2`,
        [originSettlementId, unitType],
      );
      if (!uResult.rows.length || uResult.rows[0].in_garrison < qty) {
        throw new BadRequestException(`Недостаточно ${unitType}: нужно ${qty}`);
      }
    }

    // Calculate travel time
    const dist = Math.sqrt(
      Math.pow(origin.ox - target.tx, 2) + Math.pow(origin.oy - target.ty, 2),
    );
    const slowestSpeed = this.getSlowestUnitSpeed(units);
    const worldSpeed = parseFloat(origin.movement_speed) || 1.0;

    // Travel time in seconds: distance * base_minutes_per_tile * 60 / world_speed
    const travelSeconds = Math.ceil((dist * slowestSpeed * 60) / (worldSpeed * 100));
    const now = new Date();
    const arrivesAt = new Date(now.getTime() + travelSeconds * 1000);
    const returnArrivesAt = new Date(arrivesAt.getTime() + travelSeconds * 1000);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Remove units from garrison
      for (const [unitType, qty] of Object.entries(units)) {
        if (!qty || qty <= 0) continue;
        await client.query(
          `UPDATE settlement_units
           SET in_garrison = in_garrison - $1
           WHERE settlement_id = $2 AND unit_type = $3`,
          [qty, originSettlementId, unitType],
        );
      }

      // Create movement record
      const mvResult = await client.query(
        `INSERT INTO movements
           (world_id, player_id, origin_settlement_id, target_settlement_id,
            type, status, units, resources, departs_at, arrives_at, return_arrives_at)
         VALUES ($1, $2, $3, $4, $5, 'traveling', $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          origin.world_id, profileId, originSettlementId, targetSettlementId,
          type, JSON.stringify(units),
          JSON.stringify(resources || {}),
          now, arrivesAt, returnArrivesAt,
        ],
      );
      const movement = mvResult.rows[0];

      await client.query('COMMIT');

      // Schedule arrival job
      const delay = arrivesAt.getTime() - Date.now();
      await this.movQueue.add(
        'movement-arrive',
        { movementId: movement.id, type },
        { delay: Math.max(0, delay), jobId: `mv-arrive-${movement.id}` },
      );

      return {
        ...movement,
        travelSeconds,
        arrivesAt,
        returnArrivesAt,
        distance: Math.round(dist),
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ============================================================
  // HANDLE ARRIVAL
  // ============================================================
  async handleArrival(movementId: string, type: MovementType) {
    const mvResult = await this.db.query(
      `SELECT * FROM movements WHERE id = $1 AND status = 'traveling'`,
      [movementId],
    );
    if (!mvResult.rows.length) return;
    const mv = mvResult.rows[0];

    if (type === 'attack' || type === 'raid' || type === 'capture') {
      // Will be handled by CombatService
      return { needsCombat: true, movementId };
    }

    if (type === 'support' || type === 'reinforce') {
      await this.applySupport(mv);
    }

    if (type === 'transport') {
      await this.applyTransport(mv);
    }

    // Schedule return
    const returnDelay = new Date(mv.return_arrives_at).getTime() - Date.now();
    await this.movQueue.add(
      'movement-return',
      { movementId, type },
      { delay: Math.max(0, returnDelay), jobId: `mv-return-${movementId}` },
    );
  }

  async handleReturn(movementId: string) {
    const mv = await this.db.query(
      `SELECT * FROM movements WHERE id = $1 AND status = 'returning'`,
      [movementId],
    );
    if (!mv.rows.length) return;
    const m = mv.rows[0];

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Return surviving units to garrison
      for (const [unitType, qty] of Object.entries(m.units as Record<string, number>)) {
        if (!qty || qty <= 0) continue;
        await client.query(
          `INSERT INTO settlement_units (settlement_id, unit_type, quantity, in_garrison)
           VALUES ($1, $2, $3, $3)
           ON CONFLICT (settlement_id, unit_type)
           DO UPDATE SET
             quantity = settlement_units.quantity + $3,
             in_garrison = settlement_units.in_garrison + $3`,
          [m.origin_settlement_id, unitType, qty],
        );
      }

      // Add looted resources
      const res = m.resources as any;
      if (res && Object.values(res).some((v: any) => v > 0)) {
        await client.query(
          `UPDATE settlement_resources
           SET wood   = LEAST(wood   + $1, wood_limit),
               stone  = LEAST(stone  + $2, stone_limit),
               iron   = LEAST(iron   + $3, iron_limit),
               food   = LEAST(food   + $4, food_limit),
               silver = LEAST(silver + $5, silver_limit)
           WHERE settlement_id = $6`,
          [res.wood || 0, res.stone || 0, res.iron || 0, res.food || 0, res.silver || 0,
           m.origin_settlement_id],
        );
      }

      await client.query(
        `UPDATE movements SET status = 'returned', returned_at = NOW() WHERE id = $1`,
        [movementId],
      );

      await client.query('COMMIT');

      // Notify player
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         SELECT s.owner_id, 'attack_arrived', $2, $3, $4
         FROM settlements s WHERE s.id = $1`,
        [m.origin_settlement_id, '🏠 Армия вернулась', 'Войска вернулись домой', JSON.stringify({ movementId })],
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async recallMovement(movementId: string, profileId: string) {
    const result = await this.db.query(
      `UPDATE movements SET status = 'returning'
       WHERE id = $1 AND player_id = $2 AND status = 'traveling'
       RETURNING *`,
      [movementId, profileId],
    );
    if (!result.rows.length) throw new BadRequestException('Нельзя отозвать');

    // Schedule return immediately
    const mv = result.rows[0];
    const elapsed = Date.now() - new Date(mv.departs_at).getTime();
    const returnDelay = elapsed; // Same time to return
    await this.movQueue.add(
      'movement-return',
      { movementId, type: mv.type },
      { delay: returnDelay, jobId: `mv-return-${movementId}-recall` },
    );
    return { success: true };
  }

  async getMyMovements(profileId: string) {
    const result = await this.db.query(
      `SELECT m.*,
              os.name as origin_name, os.id as origin_id,
              ts.name as target_name, ts.id as target_id,
              ot.x as ox, ot.y as oy, tt.x as tx, tt.y as ty,
              EXTRACT(EPOCH FROM (m.arrives_at - NOW()))::int as seconds_remaining
       FROM movements m
       JOIN settlements os ON os.id = m.origin_settlement_id
       JOIN settlements ts ON ts.id = m.target_settlement_id
       JOIN tiles ot ON ot.id = os.tile_id
       JOIN tiles tt ON tt.id = ts.tile_id
       WHERE m.player_id = $1 AND m.status IN ('traveling','returning')
       ORDER BY m.arrives_at ASC`,
      [profileId],
    );
    return result.rows;
  }

  private async applySupport(mv: any) {
    // Add attacker units to target garrison as support
    for (const [unitType, qty] of Object.entries(mv.units as Record<string, number>)) {
      if (!qty) continue;
      await this.db.query(
        `INSERT INTO settlement_units (settlement_id, unit_type, quantity, in_garrison)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (settlement_id, unit_type)
         DO UPDATE SET
           quantity = settlement_units.quantity + $3,
           in_garrison = settlement_units.in_garrison + $3`,
        [mv.target_settlement_id, unitType, qty],
      );
    }
    await this.db.query(
      `UPDATE movements SET status = 'returning' WHERE id = $1`, [mv.id]
    );
  }

  private async applyTransport(mv: any) {
    // Transfer resources from origin to target
    const res = mv.resources as any;
    if (!res) return;
    await this.db.query(
      `UPDATE settlement_resources
       SET wood   = LEAST(wood   + $1, wood_limit),
           stone  = LEAST(stone  + $2, stone_limit),
           iron   = LEAST(iron   + $3, iron_limit),
           food   = LEAST(food   + $4, food_limit),
           silver = LEAST(silver + $5, silver_limit)
       WHERE settlement_id = $6`,
      [res.wood || 0, res.stone || 0, res.iron || 0, res.food || 0, res.silver || 0,
       mv.target_settlement_id],
    );
    await this.db.query(
      `UPDATE movements SET status = 'returning', resources = '{}' WHERE id = $1`, [mv.id]
    );
  }

  private getSlowestUnitSpeed(units: Record<string, number>): number {
    const gc = this.config.get('game');
    let slowest = 10; // default
    for (const [unitType, qty] of Object.entries(units)) {
      if (!qty || qty <= 0) continue;
      const cfg = gc.units[unitType];
      if (cfg && cfg.speed > slowest) slowest = cfg.speed;
    }
    return slowest;
  }
}
