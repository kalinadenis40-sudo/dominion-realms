import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class AdminService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getWorldStats(worldId: string) {
    const [players, settlements, combats, movements, messages, events] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM settlements WHERE world_id = $1 AND owner_id IS NOT NULL`, [worldId]),
      this.db.query(`SELECT COUNT(*) FROM settlements WHERE world_id = $1`, [worldId]),
      this.db.query(`SELECT COUNT(*) FROM combats c JOIN settlements s ON s.id = c.settlement_id WHERE s.world_id = $1`, [worldId]),
      this.db.query(`SELECT COUNT(*) FROM movements WHERE world_id = $1 AND status IN ('traveling','returning')`, [worldId]),
      this.db.query(`SELECT COUNT(*) FROM chat_messages cm JOIN chat_rooms cr ON cr.id = cm.room_id WHERE cr.world_id = $1 AND cm.created_at > NOW() - INTERVAL '24h'`, [worldId]),
      this.db.query(`SELECT * FROM world_events WHERE world_id = $1 AND is_active = true`, [worldId]),
    ]);
    return {
      activePlayers: parseInt(players.rows[0].count),
      totalSettlements: parseInt(settlements.rows[0].count),
      totalCombats: parseInt(combats.rows[0].count),
      activeMovements: parseInt(movements.rows[0].count),
      messagesLast24h: parseInt(messages.rows[0].count),
      activeEvents: events.rows,
    };
  }

  async banPlayer(adminId: string, targetId: string, reason: string) {
    await this.checkAdmin(adminId);
    await this.db.query(`UPDATE users SET is_active = false WHERE id = (SELECT user_id FROM player_profiles WHERE id = $1)`, [targetId]);
    await this.db.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data) VALUES ($1, 'ban_player', 'player', $2, $3)`,
      [adminId, targetId, JSON.stringify({ reason })]);
    return { success: true };
  }

  async unbanPlayer(adminId: string, targetId: string) {
    await this.checkAdmin(adminId);
    await this.db.query(`UPDATE users SET is_active = true WHERE id = (SELECT user_id FROM player_profiles WHERE id = $1)`, [targetId]);
    return { success: true };
  }

  async updateWorldSpeed(adminId: string, worldId: string, speeds: { resource?: number; build?: number; train?: number; movement?: number }) {
    await this.checkAdmin(adminId);
    const sets: string[] = [];
    const params: any[] = [worldId];
    let pi = 2;
    if (speeds.resource !== undefined) { sets.push(`resource_speed = $${pi++}`); params.push(speeds.resource); }
    if (speeds.build !== undefined)    { sets.push(`build_speed = $${pi++}`);    params.push(speeds.build); }
    if (speeds.train !== undefined)    { sets.push(`train_speed = $${pi++}`);    params.push(speeds.train); }
    if (speeds.movement !== undefined) { sets.push(`movement_speed = $${pi++}`); params.push(speeds.movement); }
    if (sets.length) {
      await this.db.query(`UPDATE world_configs SET ${sets.join(', ')} WHERE world_id = $1`, params);
    }
    return { success: true };
  }

  async giveResources(adminId: string, profileId: string, resources: any) {
    await this.checkAdmin(adminId);
    const settlement = await this.db.query(`SELECT id FROM settlements WHERE owner_id = $1 LIMIT 1`, [profileId]);
    if (!settlement.rows.length) throw new Error('Поселение не найдено');

    const sets: string[] = [];
    const params: any[] = [settlement.rows[0].id];
    let pi = 2;
    if (resources.wood)   { sets.push(`wood   = LEAST(wood   + $${pi++}, wood_limit)`);   params.push(resources.wood); }
    if (resources.stone)  { sets.push(`stone  = LEAST(stone  + $${pi++}, stone_limit)`);  params.push(resources.stone); }
    if (resources.iron)   { sets.push(`iron   = LEAST(iron   + $${pi++}, iron_limit)`);   params.push(resources.iron); }
    if (resources.silver) { sets.push(`silver = LEAST(silver + $${pi++}, silver_limit)`); params.push(resources.silver); }
    if (sets.length) {
      await this.db.query(`UPDATE settlement_resources SET ${sets.join(', ')} WHERE settlement_id = $1`, params);
    }
    await this.db.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data) VALUES ($1,'give_resources','player',$2,$3)`,
      [adminId, profileId, JSON.stringify(resources)]);
    return { success: true };
  }

  async getAuditLog(adminId: string, page = 1) {
    await this.checkAdmin(adminId);
    const offset = (page - 1) * 50;
    const result = await this.db.query(
      `SELECT al.*, pp.nickname FROM audit_logs al LEFT JOIN player_profiles pp ON pp.user_id = al.user_id
       ORDER BY al.created_at DESC LIMIT 50 OFFSET $1`, [offset]
    );
    return result.rows;
  }

  async searchPlayers(adminId: string, query: string) {
    await this.checkAdmin(adminId);
    const result = await this.db.query(
      `SELECT pp.id, pp.nickname, pp.power_rating, pp.total_victories,
              u.email, u.is_active, u.last_login_at, u.created_at
       FROM player_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.nickname ILIKE $1 OR u.email ILIKE $1
       LIMIT 20`, [`%${query}%`]
    );
    return result.rows;
  }

  private async checkAdmin(userId: string) {
    const result = await this.db.query(
      `SELECT u.role FROM users u JOIN player_profiles pp ON pp.user_id = u.id WHERE pp.id = $1`, [userId]
    );
    if (!result.rows.length || !['admin','super_admin','gm','operator'].includes(result.rows[0].role)) {
      throw new ForbiddenException('Недостаточно прав');
    }
  }
}
