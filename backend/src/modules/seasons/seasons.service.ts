import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class SeasonsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getCurrentSeason(worldId: string) {
    const world = await this.db.query(
      `SELECT w.*, wc.resource_speed, wc.build_speed, wc.train_speed
       FROM worlds w JOIN world_configs wc ON wc.world_id = w.id WHERE w.id = $1`,
      [worldId],
    );
    if (!world.rows.length) return null;
    const w = world.rows[0];

    const daysLeft = w.ends_at
      ? Math.max(0, Math.ceil((new Date(w.ends_at).getTime() - Date.now()) / 86400000))
      : null;

    // Get season leaderboard (top 10)
    const leaders = await this.db.query(
      `SELECT pp.nickname, r.power_score, a.tag as alliance_tag,
              ROW_NUMBER() OVER (ORDER BY r.power_score DESC) as position
       FROM rankings r
       JOIN player_profiles pp ON pp.id = r.player_id
       LEFT JOIN alliance_members am ON am.player_id = pp.id
       LEFT JOIN alliances a ON a.id = am.alliance_id AND a.world_id = r.world_id
       WHERE r.world_id = $1
       ORDER BY r.power_score DESC LIMIT 10`,
      [worldId],
    );

    return {
      worldId: w.id,
      name: w.name,
      season: w.season_number,
      playerCount: w.player_count,
      startedAt: w.started_at,
      endsAt: w.ends_at,
      daysLeft,
      speeds: {
        resources: w.resource_speed,
        building: w.build_speed,
        training: w.train_speed,
      },
      leaders: leaders.rows,
      seasonRewards: [
        { rank: 1, title: '👑 Король сезона', reward: 'Уникальный скин поселения + 10,000 серебра' },
        { rank: 2, title: '🥈 Герой сезона',   reward: 'Редкая рамка профиля + 5,000 серебра' },
        { rank: 3, title: '🥉 Ветеран сезона', reward: 'Необычная рамка профиля + 2,500 серебра' },
        { rank: '4-10', title: '⭐ Чемпион',    reward: '1,000 серебра + достижение' },
        { rank: '11-50', title: 'Участник',     reward: '500 серебра' },
      ],
    };
  }

  async getSeasonHistory(profileId: string) {
    // For now return profile stats as season history
    const result = await this.db.query(
      `SELECT pp.total_victories, pp.total_defeats, pp.total_captures, pp.total_settlements,
              pp.power_rating, pp.war_rating
       FROM player_profiles pp WHERE pp.id = $1`,
      [profileId],
    );
    return result.rows[0];
  }
}
