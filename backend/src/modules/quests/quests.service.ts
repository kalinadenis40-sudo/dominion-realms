import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { QUEST_DEFINITIONS } from './quests.config';
import { Cron } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';

@Injectable()
export class QuestsService {
  private readonly logger = new Logger('QuestsService');

  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  // ── INIT player quests on first login ─────────────────────────
  async initPlayerQuests(profileId: string, worldId: string) {
    const existing = await this.db.query(
      `SELECT quest_type FROM player_quests WHERE player_id = $1 AND world_id = $2`,
      [profileId, worldId],
    );
    const existingTypes = new Set(existing.rows.map((r: any) => r.quest_type));

    for (const [questType, def] of Object.entries(QUEST_DEFINITIONS)) {
      if (existingTypes.has(questType)) continue;
      // Only init tutorial and daily quests automatically
      if (def.type === 'long_term' || def.type === 'tutorial') {
        await this.db.query(
          `INSERT INTO player_quests (player_id, world_id, quest_type, progress)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [profileId, worldId, questType, JSON.stringify({ current: 0 })],
        );
      }
    }
  }

  async getMyQuests(profileId: string, worldId: string) {
    await this.initPlayerQuests(profileId, worldId);

    const result = await this.db.query(
      `SELECT * FROM player_quests
       WHERE player_id = $1 AND world_id = $2
       ORDER BY is_completed ASC, created_at ASC`,
      [profileId, worldId],
    );

    return result.rows.map(q => ({
      ...q,
      definition: (QUEST_DEFINITIONS as any)[q.quest_type] || null,
    }));
  }

  async claimReward(profileId: string, worldId: string, questType: string) {
    const quest = await this.db.query(
      `SELECT * FROM player_quests
       WHERE player_id = $1 AND world_id = $2 AND quest_type = $3
         AND is_completed = true AND is_claimed = false`,
      [profileId, worldId, questType],
    );
    if (!quest.rows.length) throw new BadRequestException('Квест не завершён или уже получен');

    const def = (QUEST_DEFINITIONS as any)[questType];
    if (!def) throw new BadRequestException('Квест не найден');

    // Get main settlement
    const settlement = await this.db.query(
      `SELECT id FROM settlements WHERE owner_id = $1 AND world_id = $2 LIMIT 1`,
      [profileId, worldId],
    );
    if (!settlement.rows.length) throw new BadRequestException('Поселение не найдено');
    const settlementId = settlement.rows[0].id;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Give resources
      const r = def.reward;
      if (r) {
        const sets: string[] = [];
        const params: any[] = [settlementId];
        let pi = 2;
        if (r.wood)   { sets.push(`wood   = LEAST(wood   + $${pi++}, wood_limit)`);   params.push(r.wood); }
        if (r.stone)  { sets.push(`stone  = LEAST(stone  + $${pi++}, stone_limit)`);  params.push(r.stone); }
        if (r.iron)   { sets.push(`iron   = LEAST(iron   + $${pi++}, iron_limit)`);   params.push(r.iron); }
        if (r.food)   { sets.push(`food   = LEAST(food   + $${pi++}, food_limit)`);   params.push(r.food); }
        if (r.silver) { sets.push(`silver = LEAST(silver + $${pi++}, silver_limit)`); params.push(r.silver); }
        if (sets.length) {
          await client.query(
            `UPDATE settlement_resources SET ${sets.join(', ')} WHERE settlement_id = $1`,
            params,
          );
        }
      }

      // Mark claimed
      await client.query(
        `UPDATE player_quests SET is_claimed = true WHERE player_id = $1 AND world_id = $2 AND quest_type = $3`,
        [profileId, worldId, questType],
      );

      // Notify
      await client.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'system', $2, $3, $4)`,
        [profileId, `🎁 Награда получена: ${def.title}`, `+${Object.entries(r || {}).map(([k,v]) => `${v} ${k}`).join(', ')}`, JSON.stringify({ questType })],
      );

      await client.query('COMMIT');
      return { success: true, reward: def.reward };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── UPDATE QUEST PROGRESS ─────────────────────────────────────
  async updateProgress(profileId: string, worldId: string, event: string, value = 1) {
    // Map event → quest conditions to check
    const mappings: Record<string, string[]> = {
      building_upgraded:    ['tutorial_build_warehouse','tutorial_build_barracks','daily_upgrade_building'],
      units_trained:        ['tutorial_train_troops','daily_train_troops'],
      scout_sent:           ['tutorial_send_scout'],
      attack_sent:          ['tutorial_first_attack','daily_send_attack','long_win_10_battles'],
      alliance_joined:      ['tutorial_join_alliance'],
      research_completed:   ['tutorial_research','long_unlock_20_techs'],
      trade_completed:      ['daily_market_trade'],
      victory:              ['long_win_10_battles'],
      settlement_captured:  ['long_second_settlement'],
    };

    const questTypes = mappings[event] || [];

    for (const questType of questTypes) {
      const quest = await this.db.query(
        `SELECT * FROM player_quests
         WHERE player_id = $1 AND world_id = $2 AND quest_type = $3 AND is_completed = false`,
        [profileId, worldId, questType],
      );
      if (!quest.rows.length) continue;

      const q = quest.rows[0];
      const def = (QUEST_DEFINITIONS as any)[questType];
      if (!def) continue;

      const progress = q.progress || { current: 0 };
      progress.current = (progress.current || 0) + value;

      // Get target from condition
      const target = this.getConditionTarget(def.condition);
      const completed = progress.current >= target;

      await this.db.query(
        `UPDATE player_quests
         SET progress = $1, is_completed = $2, completed_at = $3
         WHERE player_id = $4 AND world_id = $5 AND quest_type = $6`,
        [
          JSON.stringify(progress),
          completed, completed ? new Date() : null,
          profileId, worldId, questType,
        ],
      );

      if (completed) {
        await this.db.query(
          `INSERT INTO notifications (player_id, type, title, body, data)
           VALUES ($1, 'system', $2, $3, $4)`,
          [
            profileId,
            `✅ Квест выполнен: ${def.title}`,
            'Нажми «Получить» чтобы забрать награду!',
            JSON.stringify({ questType }),
          ],
        );
      }
    }
  }

  // Reset daily quests every day at midnight
  @Cron('0 0 * * *')
  async resetDailyQuests() {
    this.logger.log('Resetting daily quests...');
    await this.db.query(
      `DELETE FROM player_quests
       WHERE quest_type IN (${Object.entries(QUEST_DEFINITIONS)
         .filter(([, d]: any) => d.type === 'daily')
         .map(([k]) => `'${k}'`)
         .join(',')})`,
    );
  }

  private getConditionTarget(condition: any): number {
    if (condition.level) return condition.level;
    if (condition.total_units) return condition.total_units;
    if (condition.scouts_sent) return condition.scouts_sent;
    if (condition.attacks_sent) return condition.attacks_sent;
    if (condition.researches_completed) return condition.researches_completed;
    if (condition.resources_collected) return condition.resources_collected;
    if (condition.units_trained) return condition.units_trained;
    if (condition.buildings_upgraded) return condition.buildings_upgraded;
    if (condition.trades_completed) return condition.trades_completed;
    if (condition.victories) return condition.victories;
    if (condition.research_levels) return condition.research_levels;
    if (condition.settlements_count) return condition.settlements_count;
    if (condition.in_alliance) return 1;
    return 1;
  }
}
