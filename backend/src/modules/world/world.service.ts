import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

@Injectable()
export class WorldService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async getActiveWorlds() {
    const result = await this.db.query(
      `SELECT w.id, w.name, w.slug, w.description, w.season_number,
              w.player_count, w.max_players, w.started_at, w.ends_at,
              wc.resource_speed, wc.build_speed, wc.train_speed
       FROM worlds w
       JOIN world_configs wc ON wc.world_id = w.id
       WHERE w.is_active = true AND w.is_registration_open = true
       ORDER BY w.created_at DESC`,
    );
    return result.rows;
  }

  async getWorldById(worldId: string) {
    const result = await this.db.query(
      `SELECT w.*, wc.*
       FROM worlds w
       JOIN world_configs wc ON wc.world_id = w.id
       WHERE w.id = $1`,
      [worldId],
    );
    if (!result.rows.length) throw new NotFoundException('Мир не найден');
    return result.rows[0];
  }

  async getDefaultWorld() {
    const result = await this.db.query(
      `SELECT w.id FROM worlds w WHERE w.is_active = true ORDER BY w.created_at ASC LIMIT 1`,
    );
    if (!result.rows.length) throw new NotFoundException('Нет активных миров');
    return result.rows[0];
  }

  // Find a free starting tile (away from center, not occupied)
  async findStartingTile(worldId: string): Promise<{ id: string; x: number; y: number }> {
    // Get world size
    const worldResult = await this.db.query(
      `SELECT map_size_x, map_size_y FROM worlds WHERE id = $1`, [worldId]
    );
    const world = worldResult.rows[0];
    const cx = Math.floor(world.map_size_x / 2);
    const cy = Math.floor(world.map_size_y / 2);

    // Try to find a free tile in rings from distance 50 outward
    for (let ring = 50; ring < 250; ring += 10) {
      const result = await this.db.query(
        `SELECT id, x, y FROM tiles
         WHERE world_id = $1
           AND has_settlement = false
           AND is_passable = true
           AND ABS(x - $2) BETWEEN $3 AND $4
           AND ABS(y - $3) BETWEEN $3 AND $4
         ORDER BY RANDOM()
         LIMIT 1`,
        [worldId, cx, ring, ring + 10],
      );
      if (result.rows.length) return result.rows[0];
    }

    // Fallback: any free tile
    const fallback = await this.db.query(
      `SELECT id, x, y FROM tiles
       WHERE world_id = $1 AND has_settlement = false AND is_passable = true
       ORDER BY RANDOM() LIMIT 1`,
      [worldId],
    );
    if (!fallback.rows.length) throw new Error('Нет свободных клеток');
    return fallback.rows[0];
  }

  async seedTiles(worldId: string, sizeX: number, sizeY: number) {
    const biomes = ['plains', 'plains', 'plains', 'forest', 'forest', 'mountains', 'swamp', 'wasteland'];
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      for (let x = 0; x < sizeX; x += 50) {
        const values: string[] = [];
        const params: any[] = [];
        let pi = 1;
        for (let dx = 0; dx < 50 && x + dx < sizeX; dx++) {
          for (let y = 0; y < sizeY; y++) {
            const biome = biomes[Math.floor(Math.random() * biomes.length)];
            values.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++})`);
            params.push(worldId, x + dx, y, biome);
          }
        }
        await client.query(
          `INSERT INTO tiles (world_id, x, y, biome) VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
          params,
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
