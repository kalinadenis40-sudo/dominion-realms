import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';
import { ResourcesService } from '../resources/resources.service';

@Injectable()
export class ResearchService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
    private readonly resourcesService: ResourcesService,
  ) {}

  async getResearchTree(profileId: string, worldId: string) {
    const gc = this.config.get('game');
    const myResearch = await this.db.query(
      `SELECT research_type, level, research_started_at, research_completes_at
       FROM player_research
       WHERE player_id = $1 AND world_id = $2`,
      [profileId, worldId],
    );
    const resMap = new Map(myResearch.rows.map(r => [r.research_type, r]));

    return Object.entries(gc.research).map(([key, def]: any) => {
      const current = resMap.get(key);
      const level = current?.level || 0;
      const isResearching = current?.research_completes_at && new Date(current.research_completes_at) > new Date();
      const secondsRemaining = isResearching
        ? Math.max(0, Math.ceil((new Date(current.research_completes_at).getTime() - Date.now()) / 1000))
        : 0;

      return {
        key,
        ...def,
        currentLevel: level,
        isResearching,
        secondsRemaining,
        completesAt: current?.research_completes_at || null,
        cost: level < def.maxLevel ? this.calcCost(def, level + 1) : null,
        duration: level < def.maxLevel ? this.calcDuration(def, level + 1) : null,
        canResearch: !isResearching && level < def.maxLevel,
        maxed: level >= def.maxLevel,
      };
    });
  }

  async startResearch(profileId: string, worldId: string, researchType: string, settlementId: string) {
    const gc = this.config.get('game');
    const def = gc.research[researchType];
    if (!def) throw new BadRequestException('Неизвестное исследование');

    // Check academy requirement
    if (def.requires?.academy) {
      const academy = await this.db.query(
        `SELECT level FROM settlement_buildings
         WHERE settlement_id = $1 AND building_type = 'academy'`,
        [settlementId],
      );
      if (!academy.rows.length || academy.rows[0].level < def.requires.academy) {
        throw new BadRequestException(`Требуется Академия уровня ${def.requires.academy}`);
      }
    }

    // Check current level
    const current = await this.db.query(
      `SELECT level, research_completes_at FROM player_research
       WHERE player_id = $1 AND world_id = $2 AND research_type = $3`,
      [profileId, worldId, researchType],
    );

    const currentLevel = current.rows[0]?.level || 0;
    if (currentLevel >= def.maxLevel) throw new BadRequestException('Максимальный уровень');

    // Check not already researching this type
    if (current.rows[0]?.research_completes_at && new Date(current.rows[0].research_completes_at) > new Date()) {
      throw new BadRequestException('Исследование уже идёт');
    }

    // Check no other research in progress for this player in this world
    const inProgress = await this.db.query(
      `SELECT id FROM player_research
       WHERE player_id = $1 AND world_id = $2
         AND research_completes_at > NOW()`,
      [profileId, worldId],
    );
    if (inProgress.rows.length) {
      throw new BadRequestException('Уже ведётся другое исследование');
    }

    const targetLevel = currentLevel + 1;
    const cost = this.calcCost(def, targetLevel);
    const duration = this.calcDuration(def, targetLevel);

    // Check resources
    const hasCost = await this.resourcesService.hasEnoughResources(settlementId, cost);
    if (!hasCost) throw new BadRequestException('Недостаточно ресурсов');

    await this.resourcesService.deductResources(settlementId, cost);

    const now = new Date();
    const completesAt = new Date(now.getTime() + duration * 1000);

    await this.db.query(
      `INSERT INTO player_research
         (player_id, world_id, research_type, level, researching_settlement_id, research_started_at, research_completes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (player_id, world_id, research_type)
       DO UPDATE SET
         researching_settlement_id = $5,
         research_started_at = $6,
         research_completes_at = $7`,
      [profileId, worldId, researchType, currentLevel, settlementId, now, completesAt],
    );

    return { researchType, targetLevel, completesAt, duration };
  }

  // Called by cron or check on request
  async checkAndCompleteResearch(profileId: string, worldId: string) {
    const completed = await this.db.query(
      `UPDATE player_research
       SET level = level + 1, research_completes_at = NULL, research_started_at = NULL
       WHERE player_id = $1 AND world_id = $2
         AND research_completes_at <= NOW()
         AND research_completes_at IS NOT NULL
       RETURNING research_type, level`,
      [profileId, worldId],
    );

    for (const r of completed.rows) {
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'system', $2, $3, $4)`,
        [
          profileId,
          `📜 Исследование завершено: ${r.research_type}`,
          `Уровень ${r.level} достигнут`,
          JSON.stringify({ researchType: r.research_type, level: r.level }),
        ],
      );
    }
    return completed.rows;
  }

  // Get effective bonuses for a player
  async getPlayerBonuses(profileId: string, worldId: string): Promise<Record<string, number>> {
    const gc = this.config.get('game');
    const myResearch = await this.db.query(
      `SELECT research_type, level FROM player_research WHERE player_id = $1 AND world_id = $2`,
      [profileId, worldId],
    );

    const bonuses: Record<string, number> = {};
    for (const r of myResearch.rows) {
      const def = gc.research[r.research_type];
      if (!def || !def.bonus) continue;
      const value = (def.bonusPerLevel || 0) * r.level;
      bonuses[def.bonus] = (bonuses[def.bonus] || 0) + value;
    }
    return bonuses;
  }

  private calcCost(def: any, level: number) {
    const mult = Math.pow(def.costMultiplier || 1.5, level - 1);
    const base = def.baseCost || {};
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(base)) {
      result[k] = Math.floor((v as number) * mult);
    }
    return result;
  }

  private calcDuration(def: any, level: number): number {
    return Math.ceil((def.timeBase || 600) * Math.pow(def.timeMultiplier || 1.5, level - 1));
  }
}
