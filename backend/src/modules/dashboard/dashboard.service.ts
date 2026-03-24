import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ResourcesService } from '../resources/resources.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly resourcesService: ResourcesService,
  ) {}

  async getDashboard(profileId: string) {
    // Run tick first so resources are up to date
    const settlements = await this.db.query(
      `SELECT s.id FROM settlements s WHERE s.owner_id = $1`, [profileId]
    );

    for (const s of settlements.rows) {
      const res = await this.db.query(
        `SELECT sr.*, wc.resource_speed FROM settlement_resources sr
         JOIN settlements st ON st.id = sr.settlement_id
         JOIN worlds w ON w.id = st.world_id
         JOIN world_configs wc ON wc.world_id = w.id
         WHERE sr.settlement_id = $1`, [s.id]
      );
      if (res.rows[0]) await this.resourcesService.tickSettlement(res.rows[0]);
    }

    // Main settlement
    const settlementResult = await this.db.query(
      `SELECT s.id, s.name, s.level, s.type, s.loyalty, s.morale, s.happiness,
              s.population, s.population_limit,
              s.has_newbie_shield, s.shield_expires_at,
              t.x, t.y, t.biome,
              sr.wood, sr.stone, sr.iron, sr.food, sr.silver,
              sr.wood_limit, sr.stone_limit, sr.iron_limit, sr.food_limit, sr.silver_limit,
              sr.wood_per_hour, sr.stone_per_hour, sr.iron_per_hour,
              sr.food_per_hour, sr.silver_per_hour, sr.food_consumption_per_hour
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       JOIN settlement_resources sr ON sr.settlement_id = s.id
       WHERE s.owner_id = $1
       ORDER BY s.created_at ASC LIMIT 1`,
      [profileId],
    );

    if (!settlementResult.rows.length) {
      return { hasSettlement: false };
    }

    const settlement = settlementResult.rows[0];
    const settlementId = settlement.id;

    // All data in parallel
    const [buildings, buildQueue, units, trainQueue, notifications, ranking, events] =
      await Promise.all([
        this.db.query(
          `SELECT building_type, level, status, hp_percent FROM settlement_buildings
           WHERE settlement_id = $1`,
          [settlementId],
        ),
        this.db.query(
          `SELECT building_type, from_level, to_level, status, completes_at,
                  starts_at, duration_seconds,
                  EXTRACT(EPOCH FROM (completes_at - NOW()))::int as seconds_remaining
           FROM building_queues
           WHERE settlement_id = $1 AND status IN ('pending','in_progress')
           ORDER BY position ASC`,
          [settlementId],
        ),
        this.db.query(
          `SELECT unit_type, quantity, in_garrison FROM settlement_units
           WHERE settlement_id = $1`,
          [settlementId],
        ),
        this.db.query(
          `SELECT unit_type, quantity, status, completes_at,
                  EXTRACT(EPOCH FROM (completes_at - NOW()))::int as seconds_remaining
           FROM training_queues
           WHERE settlement_id = $1 AND status IN ('pending','in_progress')
           ORDER BY position ASC`,
          [settlementId],
        ),
        this.db.query(
          `SELECT id, type, title, body, data, created_at, is_read
           FROM notifications
           WHERE player_id = $1 AND is_read = false
           ORDER BY created_at DESC LIMIT 15`,
          [profileId],
        ),
        this.db.query(
          `SELECT r.power_score, r.economy_score, r.war_score, r.settlements_count,
                  (SELECT COUNT(*)+1 FROM rankings r2
                   WHERE r2.world_id = r.world_id AND r2.power_score > r.power_score) as rank_position
           FROM rankings r
           JOIN settlements s ON s.world_id = r.world_id AND s.owner_id = r.player_id
           WHERE r.player_id = $1 LIMIT 1`,
          [profileId],
        ),
        this.db.query(
          `SELECT id, name, type, description, is_active, started_at, ends_at, effects
           FROM world_events
           WHERE is_active = true
           ORDER BY started_at DESC LIMIT 5`,
        ),
      ]);

    // Incoming attacks (movements targeting this settlement)
    const incomingAttacks = await this.db.query(
      `SELECT m.id, m.type, m.arrives_at, m.units,
              pp.nickname as attacker_name,
              EXTRACT(EPOCH FROM (m.arrives_at - NOW()))::int as seconds_until_arrival
       FROM movements m
       JOIN player_profiles pp ON pp.id = m.player_id
       WHERE m.target_settlement_id = $1
         AND m.status = 'traveling'
         AND m.type = 'attack'
       ORDER BY m.arrives_at ASC`,
      [settlementId],
    );

    // Outgoing movements
    const outgoing = await this.db.query(
      `SELECT m.id, m.type, m.status, m.arrives_at, m.return_arrives_at,
              EXTRACT(EPOCH FROM (m.arrives_at - NOW()))::int as seconds_remaining
       FROM movements m
       WHERE m.player_id = $1 AND m.status IN ('traveling','returning')
       ORDER BY m.arrives_at ASC LIMIT 10`,
      [profileId],
    );

    // Top 5 ranking
    const topRanking = await this.db.query(
      `SELECT pp.nickname, r.power_score,
              ROW_NUMBER() OVER (ORDER BY r.power_score DESC) as position
       FROM rankings r
       JOIN player_profiles pp ON pp.id = r.player_id
       JOIN settlements s ON s.owner_id = r.player_id
       WHERE s.id = $1
          OR r.world_id = (SELECT world_id FROM settlements WHERE id = $1)
       ORDER BY r.power_score DESC LIMIT 10`,
      [settlementId],
    );

    return {
      hasSettlement: true,
      settlement,
      resources: {
        wood:   settlement.wood,   woodLimit: settlement.wood_limit,   woodPerHour: settlement.wood_per_hour,
        stone:  settlement.stone,  stoneLimit: settlement.stone_limit, stonePerHour: settlement.stone_per_hour,
        iron:   settlement.iron,   ironLimit: settlement.iron_limit,   ironPerHour: settlement.iron_per_hour,
        food:   settlement.food,   foodLimit: settlement.food_limit,   foodPerHour: settlement.food_per_hour,
        silver: settlement.silver, silverLimit: settlement.silver_limit, silverPerHour: settlement.silver_per_hour,
        foodConsumption: settlement.food_consumption_per_hour,
      },
      buildings: buildings.rows,
      buildQueue: buildQueue.rows,
      units: units.rows,
      trainQueue: trainQueue.rows,
      notifications: notifications.rows,
      ranking: ranking.rows[0] || null,
      topRanking: topRanking.rows,
      incomingAttacks: incomingAttacks.rows,
      outgoing: outgoing.rows,
      worldEvents: events.rows,
    };
  }
}
