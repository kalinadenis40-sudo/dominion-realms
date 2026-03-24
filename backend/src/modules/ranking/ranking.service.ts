import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { Logger } from '@nestjs/common';

@Injectable()
export class RankingService {
  private readonly logger = new Logger('RankingService');

  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  // ── RECALCULATE every 10 minutes ─────────────────────────────
  @Cron('*/10 * * * *')
  async recalculateRankings() {
    try {
      const worlds = await this.db.query(`SELECT id FROM worlds WHERE is_active = true`);
      for (const w of worlds.rows) {
        await this.recalculateWorldRankings(w.id);
      }
    } catch (err) {
      this.logger.error('Ranking recalc failed', err.message);
    }
  }

  async recalculateWorldRankings(worldId: string) {
    // Power score = buildings + units + settlements * 1000
    await this.db.query(`
      INSERT INTO rankings (world_id, player_id, power_score, economy_score, war_score, dev_score, settlements_count)
      SELECT
        s.world_id,
        s.owner_id,
        -- Power: sum of building levels * 100 + unit count * 10
        COALESCE((
          SELECT SUM(sb.level) * 100
          FROM settlement_buildings sb
          JOIN settlements s2 ON s2.id = sb.settlement_id
          WHERE s2.owner_id = s.owner_id AND s2.world_id = s.world_id
        ), 0)
        + COALESCE((
          SELECT SUM(su.quantity) * 10
          FROM settlement_units su
          JOIN settlements s3 ON s3.id = su.settlement_id
          WHERE s3.owner_id = s.owner_id AND s3.world_id = s.world_id
        ), 0) as power_score,
        -- Economy: total resources per hour
        COALESCE((
          SELECT SUM(sr.wood_per_hour + sr.stone_per_hour + sr.iron_per_hour + sr.silver_per_hour)
          FROM settlement_resources sr
          JOIN settlements s4 ON s4.id = sr.settlement_id
          WHERE s4.owner_id = s.owner_id AND s4.world_id = s.world_id
        ), 0) as economy_score,
        -- War: victories
        COALESCE((
          SELECT pp.total_victories FROM player_profiles pp WHERE pp.id = s.owner_id
        ), 0) * 100 as war_score,
        -- Dev: research count
        COALESCE((
          SELECT SUM(pr.level) FROM player_research pr WHERE pr.player_id = s.owner_id AND pr.world_id = s.world_id
        ), 0) * 50 as dev_score,
        COUNT(s.id) as settlements_count
      FROM settlements s
      WHERE s.world_id = $1 AND s.owner_id IS NOT NULL
      GROUP BY s.world_id, s.owner_id
      ON CONFLICT (world_id, player_id)
      DO UPDATE SET
        power_score = EXCLUDED.power_score,
        economy_score = EXCLUDED.economy_score,
        war_score = EXCLUDED.war_score,
        dev_score = EXCLUDED.dev_score,
        settlements_count = EXCLUDED.settlements_count,
        updated_at = NOW()
    `, [worldId]);

    // Alliance rankings
    await this.db.query(`
      INSERT INTO alliance_rankings (world_id, alliance_id, power_score, war_score, territory_count)
      SELECT
        a.world_id,
        a.id,
        COALESCE(SUM(r.power_score), 0) as power_score,
        COALESCE(SUM(r.war_score), 0) as war_score,
        COALESCE(SUM(r.settlements_count), 0) as territory_count
      FROM alliances a
      LEFT JOIN alliance_members am ON am.alliance_id = a.id
      LEFT JOIN rankings r ON r.player_id = am.player_id AND r.world_id = a.world_id
      WHERE a.world_id = $1
      GROUP BY a.world_id, a.id
      ON CONFLICT (world_id, alliance_id)
      DO UPDATE SET
        power_score = EXCLUDED.power_score,
        war_score = EXCLUDED.war_score,
        territory_count = EXCLUDED.territory_count,
        updated_at = NOW()
    `, [worldId]);
  }

  // ── GET PLAYER RANKING ───────────────────────────────────────
  async getPlayerRanking(worldId: string, type: string = 'power', page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const orderCol = type === 'economy' ? 'r.economy_score'
      : type === 'war' ? 'r.war_score'
      : type === 'dev' ? 'r.dev_score'
      : 'r.power_score';

    const result = await this.db.query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ${orderCol} DESC) as position,
        pp.id as player_id, pp.nickname, pp.avatar_url,
        r.power_score, r.economy_score, r.war_score, r.dev_score,
        r.settlements_count, r.captures_count,
        a.name as alliance_name, a.tag as alliance_tag
      FROM rankings r
      JOIN player_profiles pp ON pp.id = r.player_id
      LEFT JOIN alliance_members am ON am.player_id = pp.id
      LEFT JOIN alliances a ON a.id = am.alliance_id AND a.world_id = r.world_id
      WHERE r.world_id = $1
      ORDER BY ${orderCol} DESC
      LIMIT $2 OFFSET $3
    `, [worldId, limit, offset]);

    const total = await this.db.query(
      `SELECT COUNT(*) FROM rankings WHERE world_id = $1`, [worldId]
    );

    return { rankings: result.rows, total: parseInt(total.rows[0].count), page, limit };
  }

  async getAllianceRanking(worldId: string, page = 1, limit = 30) {
    const offset = (page - 1) * limit;
    const result = await this.db.query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY ar.power_score DESC) as position,
        a.id, a.name, a.tag, a.member_count,
        ar.power_score, ar.war_score, ar.territory_count,
        pp.nickname as leader_name
      FROM alliance_rankings ar
      JOIN alliances a ON a.id = ar.alliance_id
      JOIN player_profiles pp ON pp.id = a.leader_id
      WHERE ar.world_id = $1
      ORDER BY ar.power_score DESC
      LIMIT $2 OFFSET $3
    `, [worldId, limit, offset]);
    return result.rows;
  }

  async getMyPosition(profileId: string, worldId: string) {
    const result = await this.db.query(`
      SELECT
        (SELECT COUNT(*)+1 FROM rankings r2
         WHERE r2.world_id = $2 AND r2.power_score > r.power_score) as position,
        r.*
      FROM rankings r
      WHERE r.player_id = $1 AND r.world_id = $2
    `, [profileId, worldId]);
    return result.rows[0] || null;
  }
}
