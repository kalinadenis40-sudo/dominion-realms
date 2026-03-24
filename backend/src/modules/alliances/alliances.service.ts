import {
  Injectable, Inject, BadRequestException,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class AlliancesService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  // ── CREATE ──────────────────────────────────────────────────
  async createAlliance(profileId: string, name: string, tag: string, description?: string) {
    // Check player not already in alliance
    const existing = await this.db.query(
      `SELECT am.id FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.player_id = $1`,
      [profileId],
    );
    if (existing.rows.length) throw new BadRequestException('Вы уже состоите в альянсе');

    // Get world id from player settlement
    const worldResult = await this.db.query(
      `SELECT world_id FROM settlements WHERE owner_id = $1 LIMIT 1`, [profileId]
    );
    if (!worldResult.rows.length) throw new BadRequestException('Сначала создайте поселение');
    const worldId = worldResult.rows[0].world_id;

    // Tag uniqueness
    const tagCheck = await this.db.query(
      `SELECT id FROM alliances WHERE world_id = $1 AND tag = $2`, [worldId, tag.toUpperCase()]
    );
    if (tagCheck.rows.length) throw new BadRequestException('Тег уже занят');

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const a = await client.query(
        `INSERT INTO alliances (world_id, name, tag, description, leader_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [worldId, name, tag.toUpperCase(), description || '', profileId],
      );
      const alliance = a.rows[0];

      await client.query(
        `INSERT INTO alliance_members (alliance_id, player_id, role)
         VALUES ($1, $2, 'leader')`,
        [alliance.id, profileId],
      );

      // Link player's settlements to alliance
      await client.query(
        `UPDATE settlements SET alliance_id = $1 WHERE owner_id = $2`,
        [alliance.id, profileId],
      );

      // Create alliance chat room
      await client.query(
        `INSERT INTO chat_rooms (world_id, type, name, alliance_id)
         VALUES ($1, 'alliance', $2, $3)`,
        [worldId, `${name} [${tag}]`, alliance.id],
      );

      await client.query('COMMIT');
      return alliance;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ── JOIN ─────────────────────────────────────────────────────
  async joinAlliance(profileId: string, allianceId: string) {
    const existing = await this.db.query(
      `SELECT id FROM alliance_members WHERE player_id = $1`, [profileId]
    );
    if (existing.rows.length) throw new BadRequestException('Вы уже в альянсе');

    const alliance = await this.db.query(
      `SELECT * FROM alliances WHERE id = $1`, [allianceId]
    );
    if (!alliance.rows.length) throw new NotFoundException('Альянс не найден');
    const a = alliance.rows[0];

    if (a.member_count >= a.max_members) throw new BadRequestException('Альянс заполнен');

    await this.db.query(
      `INSERT INTO alliance_members (alliance_id, player_id, role) VALUES ($1, $2, 'member')`,
      [allianceId, profileId],
    );
    await this.db.query(
      `UPDATE alliances SET member_count = member_count + 1 WHERE id = $1`, [allianceId]
    );
    await this.db.query(
      `UPDATE settlements SET alliance_id = $1 WHERE owner_id = $2`, [allianceId, profileId]
    );
    return { success: true };
  }

  // ── LEAVE ────────────────────────────────────────────────────
  async leaveAlliance(profileId: string) {
    const member = await this.db.query(
      `SELECT am.*, a.leader_id FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.player_id = $1`,
      [profileId],
    );
    if (!member.rows.length) throw new BadRequestException('Вы не в альянсе');
    const m = member.rows[0];

    if (m.leader_id === profileId) {
      throw new BadRequestException('Лидер не может покинуть альянс. Передайте лидерство сначала.');
    }

    await this.db.query(`DELETE FROM alliance_members WHERE player_id = $1`, [profileId]);
    await this.db.query(
      `UPDATE alliances SET member_count = GREATEST(0, member_count - 1) WHERE id = $1`,
      [m.alliance_id],
    );
    await this.db.query(
      `UPDATE settlements SET alliance_id = NULL WHERE owner_id = $1`, [profileId]
    );
    return { success: true };
  }

  // ── KICK ─────────────────────────────────────────────────────
  async kickMember(leaderId: string, targetProfileId: string) {
    const leaderCheck = await this.db.query(
      `SELECT am.*, a.leader_id FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.player_id = $1 AND am.role IN ('leader','deputy')`,
      [leaderId],
    );
    if (!leaderCheck.rows.length) throw new ForbiddenException('Недостаточно прав');

    const allianceId = leaderCheck.rows[0].alliance_id;
    await this.db.query(
      `DELETE FROM alliance_members WHERE player_id = $1 AND alliance_id = $2`,
      [targetProfileId, allianceId],
    );
    await this.db.query(
      `UPDATE alliances SET member_count = GREATEST(0, member_count - 1) WHERE id = $1`,
      [allianceId],
    );
    await this.db.query(
      `UPDATE settlements SET alliance_id = NULL WHERE owner_id = $1`, [targetProfileId]
    );
    return { success: true };
  }

  // ── PROMOTE ──────────────────────────────────────────────────
  async setMemberRole(leaderId: string, targetProfileId: string, role: string) {
    const validRoles = ['deputy', 'diplomat', 'war_coordinator', 'recruiter', 'treasurer', 'member'];
    if (!validRoles.includes(role)) throw new BadRequestException('Неверная роль');

    const leader = await this.db.query(
      `SELECT am.alliance_id FROM alliance_members am
       WHERE am.player_id = $1 AND am.role = 'leader'`,
      [leaderId],
    );
    if (!leader.rows.length) throw new ForbiddenException('Только лидер может менять роли');

    await this.db.query(
      `UPDATE alliance_members SET role = $1
       WHERE player_id = $2 AND alliance_id = $3`,
      [role, targetProfileId, leader.rows[0].alliance_id],
    );
    return { success: true };
  }

  // ── UPDATE ANNOUNCEMENT ───────────────────────────────────────
  async updateAnnouncement(profileId: string, announcement: string) {
    const member = await this.db.query(
      `SELECT am.alliance_id FROM alliance_members am
       WHERE am.player_id = $1 AND am.role IN ('leader','deputy')`,
      [profileId],
    );
    if (!member.rows.length) throw new ForbiddenException('Недостаточно прав');

    await this.db.query(
      `UPDATE alliances SET announcement = $1 WHERE id = $2`,
      [announcement, member.rows[0].alliance_id],
    );
    return { success: true };
  }

  // ── GET MY ALLIANCE ───────────────────────────────────────────
  async getMyAlliance(profileId: string) {
    const memberResult = await this.db.query(
      `SELECT am.role, am.joined_at, am.contribution_points,
              a.*
       FROM alliance_members am
       JOIN alliances a ON a.id = am.alliance_id
       WHERE am.player_id = $1`,
      [profileId],
    );
    if (!memberResult.rows.length) return null;

    const alliance = memberResult.rows[0];

    const members = await this.db.query(
      `SELECT am.player_id, am.role, am.joined_at, am.last_active_at, am.contribution_points,
              pp.nickname, pp.power_rating,
              (SELECT COUNT(*) FROM settlements WHERE owner_id = am.player_id) as settlement_count
       FROM alliance_members am
       JOIN player_profiles pp ON pp.id = am.player_id
       WHERE am.alliance_id = $1
       ORDER BY
         CASE am.role WHEN 'leader' THEN 0 WHEN 'deputy' THEN 1 ELSE 2 END,
         am.contribution_points DESC`,
      [alliance.id],
    );

    return { ...alliance, members: members.rows, myRole: memberResult.rows[0].role };
  }

  // ── SEARCH ALLIANCES ──────────────────────────────────────────
  async searchAlliances(worldId: string, query?: string) {
    const whereClause = query
      ? `AND (a.name ILIKE '%${query}%' OR a.tag ILIKE '%${query}%')`
      : '';

    const result = await this.db.query(
      `SELECT a.id, a.name, a.tag, a.description, a.member_count, a.max_members,
              a.power_rating, a.war_rating,
              pp.nickname as leader_name
       FROM alliances a
       JOIN player_profiles pp ON pp.id = a.leader_id
       WHERE a.world_id = $1 ${whereClause}
       ORDER BY a.power_rating DESC
       LIMIT 50`,
      [worldId],
    );
    return result.rows;
  }

  // ── GET BY ID ─────────────────────────────────────────────────
  async getAllianceById(allianceId: string) {
    const result = await this.db.query(
      `SELECT a.*, pp.nickname as leader_name
       FROM alliances a
       JOIN player_profiles pp ON pp.id = a.leader_id
       WHERE a.id = $1`,
      [allianceId],
    );
    if (!result.rows.length) throw new NotFoundException('Альянс не найден');

    const members = await this.db.query(
      `SELECT am.player_id, am.role, pp.nickname, pp.power_rating
       FROM alliance_members am
       JOIN player_profiles pp ON pp.id = am.player_id
       WHERE am.alliance_id = $1
       ORDER BY am.role, pp.power_rating DESC`,
      [allianceId],
    );
    return { ...result.rows[0], members: members.rows };
  }
}
