import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getNotifications(profileId: string, page = 1) {
    const offset = (page - 1) * 30;
    const result = await this.db.query(
      `SELECT id, type, title, body, data, is_read, created_at
       FROM notifications
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 30 OFFSET $2`,
      [profileId, offset],
    );
    return result.rows;
  }

  async markAllRead(profileId: string) {
    await this.db.query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE player_id = $1 AND is_read = false`,
      [profileId],
    );
    return { success: true };
  }

  async markRead(notifId: string, profileId: string) {
    await this.db.query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE id = $1 AND player_id = $2`,
      [notifId, profileId],
    );
    return { success: true };
  }

  async getUnreadCount(profileId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM notifications WHERE player_id = $1 AND is_read = false`,
      [profileId],
    );
    return { count: parseInt(result.rows[0].count) };
  }

  async deleteAll(profileId: string) {
    await this.db.query(
      `DELETE FROM notifications WHERE player_id = $1 AND is_read = true`,
      [profileId],
    );
    return { success: true };
  }
}
