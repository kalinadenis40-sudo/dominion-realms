import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class ReportsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getReports(profileId: string, type?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const whereType = type ? `AND r.type = '${type}'` : '';

    const result = await this.db.query(
      `SELECT r.id, r.type, r.title, r.summary, r.is_read, r.created_at,
              c.attacker_won, c.attacker_losses, c.defender_losses,
              c.resources_looted, c.capture_success, c.battle_log
       FROM reports r
       LEFT JOIN combats c ON c.id = r.combat_id
       WHERE r.owner_id = $1 AND r.is_deleted = false ${whereType}
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [profileId, limit, offset],
    );

    const count = await this.db.query(
      `SELECT COUNT(*) FROM reports WHERE owner_id = $1 AND is_deleted = false ${whereType}`,
      [profileId],
    );

    // Mark as read
    await this.db.query(
      `UPDATE reports SET is_read = true
       WHERE owner_id = $1 AND is_read = false ${whereType}`,
      [profileId],
    );

    return {
      reports: result.rows,
      total: parseInt(count.rows[0].count),
      page, limit,
    };
  }

  async getReport(reportId: string, profileId: string) {
    const result = await this.db.query(
      `SELECT r.*, c.*, sr.*
       FROM reports r
       LEFT JOIN combats c ON c.id = r.combat_id
       LEFT JOIN scout_reports sr ON sr.id = r.scout_report_id
       WHERE r.id = $1 AND r.owner_id = $2`,
      [reportId, profileId],
    );
    return result.rows[0];
  }

  async deleteReport(reportId: string, profileId: string) {
    await this.db.query(
      `UPDATE reports SET is_deleted = true WHERE id = $1 AND owner_id = $2`,
      [reportId, profileId],
    );
    return { success: true };
  }

  async getUnreadCount(profileId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM reports WHERE owner_id = $1 AND is_read = false AND is_deleted = false`,
      [profileId],
    );
    return { count: parseInt(result.rows[0].count) };
  }
}
