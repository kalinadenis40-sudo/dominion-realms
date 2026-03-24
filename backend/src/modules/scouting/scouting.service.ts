import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { MovementsService } from '../movements/movements.service';

@Injectable()
export class ScoutingService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly movementsService: MovementsService,
  ) {}

  async sendScouts(profileId: string, originSettlementId: string, targetSettlementId: string, scoutCount: number) {
    if (scoutCount < 1) throw new BadRequestException('Нужен хотя бы 1 разведчик');

    // Send as scout movement
    const movement = await this.movementsService.sendMovement({
      profileId,
      originSettlementId,
      targetSettlementId,
      type: 'scout',
      units: { scout: scoutCount },
    });

    return movement;
  }

  async processScoutArrival(movementId: string) {
    const mvResult = await this.db.query(
      `SELECT m.*, s.owner_id as scout_owner,
              ts.id as target_id, ts.owner_id as defender_owner,
              ts.loyalty, ts.morale
       FROM movements m
       JOIN settlements s ON s.id = m.origin_settlement_id
       JOIN settlements ts ON ts.id = m.target_settlement_id
       WHERE m.id = $1`,
      [movementId],
    );
    if (!mvResult.rows.length) return;
    const mv = mvResult.rows[0];

    // Check counter-intelligence (watchtower)
    const wtResult = await this.db.query(
      `SELECT sb.level, wc.resource_speed
       FROM settlement_buildings sb
       JOIN settlements s ON s.id = sb.settlement_id
       JOIN worlds w ON w.id = s.world_id
       JOIN world_configs wc ON wc.world_id = w.id
       WHERE sb.settlement_id = $1 AND sb.building_type = 'watchtower'`,
      [mv.target_id],
    );
    const watchtowerLevel = wtResult.rows[0]?.level || 0;

    const scoutCount = mv.units?.scout || 0;
    const detected = Math.random() < (watchtowerLevel * 0.05 - scoutCount * 0.02);

    // Calculate what scouts can see based on count
    const canSeeResources   = scoutCount >= 1;
    const canSeeUnits       = scoutCount >= 3;
    const canSeeBuildings   = scoutCount >= 5;
    const canSeeTechnology  = scoutCount >= 10;
    const canSeeTraps       = scoutCount >= 8;

    let resourcesSeen = null, unitsSeen = null, buildingsSeen = null;

    if (canSeeResources) {
      const res = await this.db.query(
        `SELECT wood, stone, iron, food, silver FROM settlement_resources WHERE settlement_id = $1`,
        [mv.target_id],
      );
      resourcesSeen = res.rows[0];
    }
    if (canSeeUnits) {
      const units = await this.db.query(
        `SELECT unit_type, in_garrison FROM settlement_units WHERE settlement_id = $1`,
        [mv.target_id],
      );
      unitsSeen = units.rows;
    }
    if (canSeeBuildings) {
      const buildings = await this.db.query(
        `SELECT building_type, level FROM settlement_buildings WHERE settlement_id = $1`,
        [mv.target_id],
      );
      buildingsSeen = buildings.rows;
    }

    // Save scout report
    const reportResult = await this.db.query(
      `INSERT INTO scout_reports
         (movement_id, scout_player_id, target_settlement_id,
          resources_seen, units_seen, buildings_seen,
          loyalty_seen, traps_detected, detected, scout_success_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        movementId, mv.scout_owner, mv.target_id,
        resourcesSeen ? JSON.stringify(resourcesSeen) : null,
        unitsSeen ? JSON.stringify(unitsSeen) : null,
        buildingsSeen ? JSON.stringify(buildingsSeen) : null,
        canSeeResources ? mv.loyalty : null,
        canSeeTraps,
        detected,
        Math.min(100, scoutCount * 10),
      ],
    );

    // Create report for scout player
    await this.db.query(
      `INSERT INTO reports (world_id, owner_id, type, title, summary, full_data, scout_report_id)
       SELECT s.world_id, $2, 'scout', $3, $4, $5, $6
       FROM settlements s WHERE s.id = $1`,
      [
        mv.origin_settlement_id, mv.scout_owner,
        detected ? '🔍 Разведка — ОБНАРУЖЕНА' : '🔍 Разведка завершена',
        JSON.stringify({ detected, scoutCount, targetId: mv.target_id }),
        JSON.stringify({ resourcesSeen, unitsSeen, buildingsSeen, loyalty: mv.loyalty, detected }),
        reportResult.rows[0].id,
      ],
    );

    // Notify defender if detected
    if (detected && mv.defender_owner) {
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'attack_incoming', '🔍 Обнаружена разведка', 'Враг пытается шпионить за вашим поселением', $2)`,
        [mv.defender_owner, JSON.stringify({ movementId })],
      );
    }

    // Update movement to returning
    await this.db.query(
      `UPDATE movements SET status = 'returning' WHERE id = $1`, [movementId]
    );

    return { detected, resourcesSeen, unitsSeen };
  }

  async getScoutReports(profileId: string) {
    const result = await this.db.query(
      `SELECT r.*, sr.resources_seen, sr.units_seen, sr.buildings_seen,
              sr.loyalty_seen, sr.traps_detected, sr.detected,
              ts.name as target_name, tt.x, tt.y
       FROM reports r
       JOIN scout_reports sr ON sr.id = r.scout_report_id
       JOIN settlements ts ON ts.id = sr.target_settlement_id
       JOIN tiles tt ON tt.id = ts.tile_id
       WHERE r.owner_id = $1 AND r.type = 'scout'
       ORDER BY r.created_at DESC LIMIT 50`,
      [profileId],
    );
    return result.rows;
  }
}
