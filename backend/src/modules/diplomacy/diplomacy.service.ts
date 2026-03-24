import { Injectable, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

type DiplomacyType = 'peace' | 'truce' | 'alliance' | 'war' | 'trade_pact' | 'passage';

@Injectable()
export class DiplomacyService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async proposeDiplomacy(profileId: string, targetAllianceId: string, type: DiplomacyType) {
    // Get initiating alliance
    const myAlliance = await this.db.query(
      `SELECT am.alliance_id FROM alliance_members am
       WHERE am.player_id = $1 AND am.role IN ('leader','deputy','diplomat')`,
      [profileId],
    );
    if (!myAlliance.rows.length) throw new ForbiddenException('Нет прав на дипломатию');
    const myAllianceId = myAlliance.rows[0].alliance_id;

    if (myAllianceId === targetAllianceId) throw new BadRequestException('Нельзя с самим собой');

    // Check existing relation
    const existing = await this.db.query(
      `SELECT * FROM alliance_relations
       WHERE (alliance_a_id = $1 AND alliance_b_id = $2)
          OR (alliance_a_id = $2 AND alliance_b_id = $1)`,
      [myAllianceId, targetAllianceId],
    );

    // Get world id
    const worldResult = await this.db.query(
      `SELECT world_id FROM alliances WHERE id = $1`, [myAllianceId]
    );
    const worldId = worldResult.rows[0].world_id;

    if (existing.rows.length) {
      // Update existing
      await this.db.query(
        `UPDATE alliance_relations
         SET type = $1, initiated_by = $2, confirmed = $3, updated_at = NOW()
         WHERE id = $4`,
        [type, myAllianceId, type === 'war' ? true : false, existing.rows[0].id],
      );
    } else {
      await this.db.query(
        `INSERT INTO alliance_relations
           (world_id, alliance_a_id, alliance_b_id, type, initiated_by, confirmed)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [worldId, myAllianceId, targetAllianceId, type, myAllianceId, type === 'war'],
      );
    }

    // Notify target alliance leader
    const targetLeader = await this.db.query(
      `SELECT leader_id FROM alliances WHERE id = $1`, [targetAllianceId]
    );
    if (targetLeader.rows.length) {
      const myAllianceName = await this.db.query(
        `SELECT name, tag FROM alliances WHERE id = $1`, [myAllianceId]
      );
      const an = myAllianceName.rows[0];
      await this.db.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'alliance_message', $2, $3, $4)`,
        [
          targetLeader.rows[0].leader_id,
          `[${an.tag}] ${type === 'war' ? '⚔ Объявлена война!' : '🤝 Дипломатическое предложение'}`,
          `Альянс ${an.name} предлагает: ${type}`,
          JSON.stringify({ allianceId: myAllianceId, type }),
        ],
      );
    }

    return { success: true, type };
  }

  async confirmRelation(profileId: string, relationId: string) {
    const relation = await this.db.query(
      `SELECT ar.*, am.alliance_id FROM alliance_relations ar
       JOIN alliance_members am ON am.alliance_id = ar.alliance_b_id
       WHERE ar.id = $1 AND am.player_id = $2
         AND am.role IN ('leader','deputy','diplomat')`,
      [relationId, profileId],
    );
    if (!relation.rows.length) throw new ForbiddenException('Нет прав');

    await this.db.query(
      `UPDATE alliance_relations SET confirmed = true, updated_at = NOW() WHERE id = $1`,
      [relationId],
    );
    return { success: true };
  }

  async getRelations(allianceId: string) {
    const result = await this.db.query(
      `SELECT ar.*,
              a_a.name as alliance_a_name, a_a.tag as alliance_a_tag,
              a_b.name as alliance_b_name, a_b.tag as alliance_b_tag
       FROM alliance_relations ar
       JOIN alliances a_a ON a_a.id = ar.alliance_a_id
       JOIN alliances a_b ON a_b.id = ar.alliance_b_id
       WHERE ar.alliance_a_id = $1 OR ar.alliance_b_id = $1
       ORDER BY ar.updated_at DESC`,
      [allianceId],
    );
    return result.rows;
  }

  async getMyRelations(profileId: string) {
    const member = await this.db.query(
      `SELECT alliance_id FROM alliance_members WHERE player_id = $1`, [profileId]
    );
    if (!member.rows.length) return [];
    return this.getRelations(member.rows[0].alliance_id);
  }
}
