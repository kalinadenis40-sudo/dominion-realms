import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ACHIEVEMENT_DEFINITIONS } from './achievements.config';

@Injectable()
export class AchievementsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getMyAchievements(profileId: string) {
    const unlocked = await this.db.query(
      `SELECT achievement_type, unlocked_at FROM player_achievements WHERE player_id = $1`,
      [profileId],
    );
    const unlockedMap = new Map(unlocked.rows.map(r => [r.achievement_type, r.unlocked_at]));

    return Object.entries(ACHIEVEMENT_DEFINITIONS).map(([key, def]) => ({
      key,
      ...def,
      unlocked: unlockedMap.has(key),
      unlocked_at: unlockedMap.get(key) || null,
    }));
  }

  async checkAndUnlock(profileId: string, event: string, value = 1) {
    // Map events to achievement conditions
    const checkMap: Record<string, string[]> = {
      victory: ['first_blood', 'warrior_i', 'warrior_ii', 'warrior_iii'],
      capture: ['conqueror', 'empire'],
      building_upgraded: ['builder_i', 'architect', 'master_builder'],
      scout_sent: ['scout_i', 'spy_master'],
      research_completed: ['researcher_i', 'sage'],
      alliance_joined: ['diplomat_i'],
      war_declared: ['alliance_war'],
    };

    const toCheck = checkMap[event] || [];
    for (const achievementType of toCheck) {
      await this.tryUnlock(profileId, achievementType, event, value);
    }
  }

  private async tryUnlock(profileId: string, achievementType: string, event: string, value: number) {
    // Already unlocked?
    const existing = await this.db.query(
      `SELECT id FROM player_achievements WHERE player_id = $1 AND achievement_type = $2`,
      [profileId, achievementType],
    );
    if (existing.rows.length) return;

    const def = ACHIEVEMENT_DEFINITIONS[achievementType];
    if (!def) return;

    // Check if condition met using player stats
    const met = await this.checkCondition(profileId, def.condition);
    if (!met) return;

    await this.db.query(
      `INSERT INTO player_achievements (player_id, achievement_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [profileId, achievementType],
    );

    // Notify player
    const rarityEmoji = { common: '⭐', rare: '💎', epic: '🔮', legendary: '👑' };
    await this.db.query(
      `INSERT INTO notifications (player_id, type, title, body, data)
       VALUES ($1, 'system', $2, $3, $4)`,
      [
        profileId,
        `${rarityEmoji[def.rarity]} Достижение: ${def.title}`,
        def.description,
        JSON.stringify({ achievementType, rarity: def.rarity }),
      ],
    );
  }

  private async checkCondition(profileId: string, condition: Record<string, number>): Promise<boolean> {
    const stats = await this.getPlayerStats(profileId);

    for (const [key, required] of Object.entries(condition)) {
      const current = (stats as any)[key] || 0;
      if (current < required) return false;
    }
    return true;
  }

  private async getPlayerStats(profileId: string) {
    const result = await this.db.query(
      `SELECT
         pp.total_victories as victories,
         pp.total_captures as captures,
         (SELECT COUNT(*) FROM player_achievements WHERE player_id = $1) as achievements_count,
         (SELECT COALESCE(SUM(su.quantity), 0) FROM settlement_units su
          JOIN settlements s ON s.id = su.settlement_id WHERE s.owner_id = $1) as total_units
       FROM player_profiles pp WHERE pp.id = $1`,
      [profileId],
    );
    return result.rows[0] || {};
  }
}
