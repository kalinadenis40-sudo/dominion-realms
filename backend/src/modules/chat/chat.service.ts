import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class ChatService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getOrCreateGlobalRoom(worldId: string) {
    const existing = await this.db.query(
      `SELECT id FROM chat_rooms WHERE world_id = $1 AND type = 'global' LIMIT 1`, [worldId]
    );
    if (existing.rows.length) return existing.rows[0].id;

    const result = await this.db.query(
      `INSERT INTO chat_rooms (world_id, type, name) VALUES ($1, 'global', 'Глобальный чат') RETURNING id`,
      [worldId],
    );
    return result.rows[0].id;
  }

  async getMyRooms(profileId: string) {
    // Get world from settlement
    const worldResult = await this.db.query(
      `SELECT world_id FROM settlements WHERE owner_id = $1 LIMIT 1`, [profileId]
    );
    if (!worldResult.rows.length) return [];
    const worldId = worldResult.rows[0].world_id;

    // Get global room
    const globalId = await this.getOrCreateGlobalRoom(worldId);

    const rooms: any[] = [{ id: globalId, type: 'global', name: 'Глобальный чат', world_id: worldId }];

    // Alliance room
    const allianceRoom = await this.db.query(
      `SELECT cr.id, cr.name, cr.type FROM chat_rooms cr
       JOIN alliance_members am ON am.alliance_id = cr.alliance_id
       WHERE am.player_id = $1 AND cr.type = 'alliance'`,
      [profileId],
    );
    if (allianceRoom.rows.length) rooms.push(allianceRoom.rows[0]);

    return rooms;
  }

  async getMessages(roomId: string, profileId: string, limit = 50, before?: string) {
    // Check access
    const room = await this.db.query(`SELECT * FROM chat_rooms WHERE id = $1`, [roomId]);
    if (!room.rows.length) return [];

    const r = room.rows[0];
    if (r.type === 'alliance') {
      const access = await this.db.query(
        `SELECT am.id FROM alliance_members am
         JOIN chat_rooms cr ON cr.alliance_id = am.alliance_id
         WHERE cr.id = $1 AND am.player_id = $2`,
        [roomId, profileId],
      );
      if (!access.rows.length) throw new ForbiddenException('Нет доступа к чату');
    }

    const beforeClause = before ? `AND cm.id < '${before}'` : '';
    const result = await this.db.query(
      `SELECT cm.id, cm.content, cm.created_at, cm.metadata,
              pp.nickname as sender_name, pp.id as sender_id
       FROM chat_messages cm
       LEFT JOIN player_profiles pp ON pp.id = cm.sender_id
       WHERE cm.room_id = $1 AND cm.is_deleted = false ${beforeClause}
       ORDER BY cm.created_at DESC
       LIMIT $2`,
      [roomId, limit],
    );
    return result.rows.reverse();
  }

  async sendMessage(roomId: string, profileId: string, content: string) {
    if (!content?.trim() || content.length > 500) {
      throw new Error('Сообщение пустое или слишком длинное');
    }

    // Rate limit: max 1 message per 2 seconds
    const recent = await this.db.query(
      `SELECT id FROM chat_messages
       WHERE sender_id = $1 AND room_id = $2
         AND created_at > NOW() - INTERVAL '2 seconds'`,
      [profileId, roomId],
    );
    if (recent.rows.length > 0) throw new Error('Слишком быстро');

    const result = await this.db.query(
      `INSERT INTO chat_messages (room_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING id, content, created_at`,
      [roomId, profileId, content.trim()],
    );

    const senderResult = await this.db.query(
      `SELECT nickname FROM player_profiles WHERE id = $1`, [profileId]
    );

    return {
      ...result.rows[0],
      sender_id: profileId,
      sender_name: senderResult.rows[0]?.nickname || 'Unknown',
      room_id: roomId,
    };
  }

  async deleteMessage(messageId: string, profileId: string) {
    // Only sender or moderator
    await this.db.query(
      `UPDATE chat_messages SET is_deleted = true
       WHERE id = $1 AND sender_id = $2`,
      [messageId, profileId],
    );
    return { success: true };
  }
}
