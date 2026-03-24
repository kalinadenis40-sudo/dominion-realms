import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { WorldService } from '../world/world.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly worldService: WorldService,
    private readonly config: ConfigService,
  ) {}

  // Called right after user registers — creates their first settlement
  async createStartingSettlement(profileId: string, nickname: string) {
    const world = await this.worldService.getDefaultWorld();
    const worldId = world.id;

    // Check player doesn't already have a settlement in this world
    const existing = await this.db.query(
      `SELECT id FROM settlements WHERE owner_id = $1 AND world_id = $2`,
      [profileId, worldId],
    );
    if (existing.rows.length) return existing.rows[0];

    const tile = await this.worldService.findStartingTile(worldId);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Get world config for shield duration
      const wc = await client.query(
        `SELECT newbie_shield_hours FROM world_configs WHERE world_id = $1`, [worldId]
      );
      const shieldHours = wc.rows[0]?.newbie_shield_hours ?? 72;
      const shieldExpires = new Date(Date.now() + shieldHours * 3600 * 1000);

      // Create settlement
      const settlementResult = await client.query(
        `INSERT INTO settlements
           (world_id, owner_id, tile_id, name, type, level, has_newbie_shield, shield_expires_at)
         VALUES ($1, $2, $3, $4, 'normal', 1, true, $5)
         RETURNING *`,
        [worldId, profileId, tile.id, `${nickname}'s Realm`, shieldExpires],
      );
      const settlement = settlementResult.rows[0];

      // Mark tile as occupied
      await client.query(
        `UPDATE tiles SET has_settlement = true WHERE id = $1`, [tile.id]
      );

      // Create resources (starting amounts)
      await client.query(
        `INSERT INTO settlement_resources
           (settlement_id, wood, stone, iron, food, silver,
            wood_limit, stone_limit, iron_limit, food_limit, silver_limit,
            wood_per_hour, stone_per_hour, iron_per_hour, food_per_hour, silver_per_hour)
         VALUES ($1, 800, 600, 300, 500, 100,
                 2000, 2000, 1500, 2000, 1000,
                 30, 20, 10, 40, 5)`,
        [settlement.id],
      );

      // Create starting buildings (level 0 = exists but not built, level 1 = basic)
      const startingBuildings = [
        { type: 'main_building', level: 1 },
        { type: 'sawmill', level: 1 },
        { type: 'quarry', level: 1 },
        { type: 'farm', level: 1 },
        { type: 'warehouse', level: 1 },
        { type: 'barracks', level: 0 },
        { type: 'wall', level: 0 },
        { type: 'watchtower', level: 0 },
      ];

      for (const b of startingBuildings) {
        await client.query(
          `INSERT INTO settlement_buildings (settlement_id, building_type, level)
           VALUES ($1, $2, $3)`,
          [settlement.id, b.type, b.level],
        );
      }

      // Create starting units (small garrison)
      await client.query(
        `INSERT INTO settlement_units (settlement_id, unit_type, quantity, in_garrison)
         VALUES ($1, 'spearman', 10, 10)`,
        [settlement.id],
      );

      // Update world player count
      await client.query(
        `UPDATE worlds SET player_count = player_count + 1 WHERE id = $1`, [worldId]
      );

      // Create ranking entry
      await client.query(
        `INSERT INTO rankings (world_id, player_id, settlements_count)
         VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`,
        [worldId, profileId],
      );

      await client.query('COMMIT');

      return { ...settlement, tile_x: tile.x, tile_y: tile.y };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getMySettlements(profileId: string) {
    const result = await this.db.query(
      `SELECT s.*, t.x, t.y, t.biome,
              sr.wood, sr.stone, sr.iron, sr.food, sr.silver,
              sr.wood_limit, sr.stone_limit, sr.iron_limit, sr.food_limit,
              sr.wood_per_hour, sr.stone_per_hour, sr.iron_per_hour,
              sr.food_per_hour, sr.silver_per_hour, sr.food_consumption_per_hour,
              sr.last_tick_at
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN settlement_resources sr ON sr.settlement_id = s.id
       WHERE s.owner_id = $1
       ORDER BY s.created_at ASC`,
      [profileId],
    );
    return result.rows;
  }

  async getSettlementById(settlementId: string, profileId: string) {
    const result = await this.db.query(
      `SELECT s.*, t.x, t.y, t.biome,
              sr.wood, sr.stone, sr.iron, sr.food, sr.silver,
              sr.wood_limit, sr.stone_limit, sr.food_limit,
              sr.wood_per_hour, sr.stone_per_hour, sr.iron_per_hour,
              sr.food_per_hour, sr.silver_per_hour,
              sr.food_consumption_per_hour, sr.last_tick_at
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN settlement_resources sr ON sr.settlement_id = s.id
       WHERE s.id = $1`,
      [settlementId],
    );
    if (!result.rows.length) throw new NotFoundException('Поселение не найдено');
    return result.rows[0];
  }

  async getSettlementWithBuildings(settlementId: string) {
    const [settlement, buildings, units] = await Promise.all([
      this.getSettlementById(settlementId, ''),
      this.db.query(
        `SELECT * FROM settlement_buildings WHERE settlement_id = $1 ORDER BY building_type`,
        [settlementId],
      ),
      this.db.query(
        `SELECT * FROM settlement_units WHERE settlement_id = $1`,
        [settlementId],
      ),
    ]);
    return { ...settlement, buildings: buildings.rows, units: units.rows };
  }
}
