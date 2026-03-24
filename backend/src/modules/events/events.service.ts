import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';

const EVENT_TEMPLATES = [
  {
    type: 'gold_rush',
    name: 'Золотая лихорадка',
    description: 'Производство серебра увеличено вдвое во всех поселениях',
    icon: '⭐',
    duration_hours: 6,
    effects: { silver_multiplier: 2.0 },
    color: '#B8922A',
  },
  {
    type: 'harvest',
    name: 'Урожайный сезон',
    description: 'Производство еды увеличено в 3 раза. Армии не требуют снабжения',
    icon: '🌾',
    duration_hours: 8,
    effects: { food_multiplier: 3.0, no_upkeep: true },
    color: '#4CAF7D',
  },
  {
    type: 'storm',
    name: 'Буря',
    description: 'Скорость передвижения армий снижена на 50%. Защита +20%',
    icon: '⛈',
    duration_hours: 4,
    effects: { movement_speed_mult: 0.5, defense_bonus: 0.2 },
    color: '#4A6B8A',
  },
  {
    type: 'invasion',
    name: 'Нашествие варваров',
    description: 'Лагеря разбойников усилены. Атаки на них приносят двойные награды',
    icon: '💀',
    duration_hours: 12,
    effects: { pve_reward_mult: 2.0, barbarian_strength_mult: 1.5 },
    color: '#8B2020',
  },
  {
    type: 'comet',
    name: 'Падение кометы',
    description: 'Скорость строительства увеличена вдвое. Редкий шанс найти артефакт',
    icon: '☄️',
    duration_hours: 6,
    effects: { build_speed_mult: 2.0, artifact_chance: 0.1 },
    color: '#7B5EA7',
  },
  {
    type: 'plague',
    name: 'Мор',
    description: 'Производство еды снижено на 40%. Мораль падает медленнее',
    icon: '🦠',
    duration_hours: 5,
    effects: { food_multiplier: 0.6, morale_decay_reduction: 0.5 },
    color: '#556B2F',
  },
  {
    type: 'market_boom',
    name: 'Торговый бум',
    description: 'Комиссия рынка снижена до 0. Лимиты торговли увеличены',
    icon: '💰',
    duration_hours: 8,
    effects: { market_fee: 0, trade_limit_mult: 3.0 },
    color: '#CD7F32',
  },
  {
    type: 'training_festival',
    name: 'Фестиваль воинов',
    description: 'Скорость обучения войск увеличена в 3 раза',
    icon: '🏟',
    duration_hours: 6,
    effects: { train_speed_mult: 3.0 },
    color: '#8B2020',
  },
];

@Injectable()
export class EventsService {
  private readonly logger = new Logger('EventsService');

  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  // ── AUTO-LAUNCH event every ~24h ───────────────────────────────
  @Cron('0 */6 * * *') // Every 6 hours check if we need a new event
  async maybeStartRandomEvent() {
    const worlds = await this.db.query(`SELECT id FROM worlds WHERE is_active = true`);
    for (const w of worlds.rows) {
      await this.maybeStartEventForWorld(w.id);
    }
  }

  async maybeStartEventForWorld(worldId: string) {
    // Check if already has active event
    const active = await this.db.query(
      `SELECT id FROM world_events WHERE world_id = $1 AND is_active = true`,
      [worldId],
    );
    if (active.rows.length) return;

    // 40% chance to start a new event
    if (Math.random() > 0.4) return;

    const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
    await this.startEvent(worldId, template.type);
    this.logger.log(`Started event "${template.name}" in world ${worldId}`);
  }

  async startEvent(worldId: string, eventType: string) {
    const template = EVENT_TEMPLATES.find(t => t.type === eventType);
    if (!template) return;

    const now = new Date();
    const endsAt = new Date(now.getTime() + template.duration_hours * 3600000);

    // End any active events first
    await this.db.query(
      `UPDATE world_events SET is_active = false WHERE world_id = $1 AND is_active = true`,
      [worldId],
    );

    await this.db.query(
      `INSERT INTO world_events (world_id, type, name, description, config, effects, is_active, started_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [worldId, template.type, template.name, template.description,
       JSON.stringify({ icon: template.icon, color: template.color, duration_hours: template.duration_hours }),
       JSON.stringify(template.effects), now, endsAt],
    );

    // Broadcast notification to all players in world
    await this.db.query(
      `INSERT INTO notifications (player_id, type, title, body, data)
       SELECT s.owner_id, 'event_start', $2, $3, $4
       FROM settlements s WHERE s.world_id = $1 AND s.owner_id IS NOT NULL`,
      [
        worldId,
        `${template.icon} Событие: ${template.name}`,
        `${template.description} (${template.duration_hours}ч)`,
        JSON.stringify({ eventType: template.type }),
      ],
    );
  }

  // ── AUTO-END expired events ────────────────────────────────────
  @Cron('*/5 * * * *')
  async endExpiredEvents() {
    await this.db.query(
      `UPDATE world_events SET is_active = false
       WHERE is_active = true AND ends_at < NOW()`,
    );
  }

  async getActiveEvents(worldId: string) {
    const result = await this.db.query(
      `SELECT *, EXTRACT(EPOCH FROM (ends_at - NOW()))::int as seconds_remaining
       FROM world_events
       WHERE world_id = $1 AND is_active = true
       ORDER BY started_at DESC`,
      [worldId],
    );
    return result.rows;
  }

  async getEventHistory(worldId: string) {
    const result = await this.db.query(
      `SELECT * FROM world_events
       WHERE world_id = $1
       ORDER BY started_at DESC LIMIT 20`,
      [worldId],
    );
    return result.rows;
  }

  // Get current active effects for a world (used by other services)
  async getActiveEffects(worldId: string): Promise<Record<string, any>> {
    const events = await this.getActiveEvents(worldId);
    const effects: Record<string, any> = {};
    for (const e of events) {
      Object.assign(effects, e.effects || {});
    }
    return effects;
  }
}
