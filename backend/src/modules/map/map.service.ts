import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class MapService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  // Load settlements visible in viewport
  async getMapViewport(worldId: string, x1: number, y1: number, x2: number, y2: number, profileId: string) {
    const settlements = await this.db.query(
      `SELECT s.id, s.name, s.type, s.level, s.owner_id, s.alliance_id,
              s.has_newbie_shield, s.shield_expires_at,
              t.x, t.y, t.biome,
              pp.nickname as owner_name,
              a.tag as alliance_tag,
              CASE
                WHEN s.owner_id = $3 THEN 'own'
                WHEN am.alliance_id IS NOT NULL THEN 'allied'
                WHEN s.owner_id IS NULL THEN 'neutral'
                ELSE 'enemy'
              END as relation
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN player_profiles pp ON pp.id = s.owner_id
       LEFT JOIN alliances a ON a.id = s.alliance_id
       LEFT JOIN alliance_members am ON am.player_id = $3
         AND am.alliance_id = s.alliance_id
       WHERE s.world_id = $1
         AND t.x BETWEEN $4 AND $5
         AND t.y BETWEEN $6 AND $7
       LIMIT 500`,
      [worldId, profileId, profileId, x1, x2, y1, y2],
    );

    // Active movements in viewport (arrows on map)
    const movements = await this.db.query(
      `SELECT m.id, m.type, m.status, m.arrives_at, m.player_id,
              ot.x as ox, ot.y as oy, tt.x as tx, tt.y as ty,
              EXTRACT(EPOCH FROM (m.arrives_at - NOW()))::int as seconds_remaining
       FROM movements m
       JOIN settlements os ON os.id = m.origin_settlement_id
       JOIN settlements ts ON ts.id = m.target_settlement_id
       JOIN tiles ot ON ot.id = os.tile_id
       JOIN tiles tt ON tt.id = ts.tile_id
       WHERE os.world_id = $1
         AND m.status IN ('traveling','returning')
         AND (m.player_id = $2 OR ts.owner_id = $2)`,
      [worldId, profileId],
    );

    return {
      settlements: settlements.rows,
      movements: movements.rows,
    };
  }

  async getSettlementCard(settlementId: string, viewerProfileId: string) {
    const result = await this.db.query(
      `SELECT s.id, s.name, s.type, s.level, s.loyalty, s.morale,
              t.x, t.y, t.biome,
              pp.nickname as owner_name,
              a.name as alliance_name, a.tag as alliance_tag,
              s.has_newbie_shield, s.shield_expires_at,
              CASE
                WHEN s.owner_id = $2 THEN 'own'
                WHEN s.owner_id IS NULL THEN 'neutral'
                ELSE 'enemy'
              END as relation
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN player_profiles pp ON pp.id = s.owner_id
       LEFT JOIN alliances a ON a.id = s.alliance_id
       WHERE s.id = $1`,
      [settlementId, viewerProfileId],
    );
    return result.rows[0];
  }

  async searchByCoords(worldId: string, x: number, y: number) {
    const result = await this.db.query(
      `SELECT s.id, s.name, pp.nickname as owner_name, t.x, t.y
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN player_profiles pp ON pp.id = s.owner_id
       WHERE s.world_id = $1 AND t.x = $2 AND t.y = $3
       LIMIT 1`,
      [worldId, x, y],
    );
    return result.rows[0] || null;
  }

  async searchByPlayer(worldId: string, query: string) {
    const result = await this.db.query(
      `SELECT s.id, s.name, pp.nickname as owner_name, t.x, t.y
       FROM settlements s
       JOIN tiles t ON t.id = s.tile_id
       LEFT JOIN player_profiles pp ON pp.id = s.owner_id
       WHERE s.world_id = $1 AND (
         s.name ILIKE $2 OR pp.nickname ILIKE $2
       )
       LIMIT 20`,
      [worldId, `%${query}%`],
    );
    return result.rows;
  }
}
