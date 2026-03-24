import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class MessagesService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async sendMessage(senderId: string, recipientNickname: string, subject: string, content: string) {
    const recipient = await this.db.query(
      `SELECT id FROM player_profiles WHERE nickname = $1`, [recipientNickname]
    );
    if (!recipient.rows.length) throw new NotFoundException('Игрок не найден');

    const result = await this.db.query(
      `INSERT INTO private_messages (sender_id, recipient_id, subject, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [senderId, recipient.rows[0].id, subject, content],
    );

    // Notify recipient
    await this.db.query(
      `INSERT INTO notifications (player_id, type, title, body, data)
       SELECT $1, 'alliance_message', $2, $3, $4`,
      [
        recipient.rows[0].id,
        '✉ Новое сообщение',
        `От: ${(await this.db.query(`SELECT nickname FROM player_profiles WHERE id=$1`, [senderId])).rows[0]?.nickname}`,
        JSON.stringify({ messageId: result.rows[0].id }),
      ],
    );

    return result.rows[0];
  }

  async getInbox(profileId: string, page = 1) {
    const offset = (page - 1) * 20;
    const result = await this.db.query(
      `SELECT pm.id, pm.subject, pm.is_read, pm.created_at,
              pp.nickname as sender_name
       FROM private_messages pm
       JOIN player_profiles pp ON pp.id = pm.sender_id
       WHERE pm.recipient_id = $1 AND pm.is_deleted_by_recipient = false
       ORDER BY pm.created_at DESC
       LIMIT 20 OFFSET $2`,
      [profileId, offset],
    );
    return result.rows;
  }

  async getSent(profileId: string) {
    const result = await this.db.query(
      `SELECT pm.id, pm.subject, pm.created_at,
              pp.nickname as recipient_name
       FROM private_messages pm
       JOIN player_profiles pp ON pp.id = pm.recipient_id
       WHERE pm.sender_id = $1 AND pm.is_deleted_by_sender = false
       ORDER BY pm.created_at DESC
       LIMIT 50`,
      [profileId],
    );
    return result.rows;
  }

  async getMessage(messageId: string, profileId: string) {
    const result = await this.db.query(
      `SELECT pm.*,
              ps.nickname as sender_name,
              pr.nickname as recipient_name
       FROM private_messages pm
       JOIN player_profiles ps ON ps.id = pm.sender_id
       JOIN player_profiles pr ON pr.id = pm.recipient_id
       WHERE pm.id = $1 AND (pm.sender_id = $2 OR pm.recipient_id = $2)`,
      [messageId, profileId],
    );
    if (!result.rows.length) throw new NotFoundException('Сообщение не найдено');

    // Mark read
    if (result.rows[0].recipient_id === profileId) {
      await this.db.query(
        `UPDATE private_messages SET is_read = true, read_at = NOW() WHERE id = $1`, [messageId]
      );
    }
    return result.rows[0];
  }

  async getUnreadCount(profileId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM private_messages
       WHERE recipient_id = $1 AND is_read = false AND is_deleted_by_recipient = false`,
      [profileId],
    );
    return { count: parseInt(result.rows[0].count) };
  }
}
