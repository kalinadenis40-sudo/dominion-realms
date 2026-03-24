import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ResourcesService } from '../resources/resources.service';

const MARKET_FEE = 0.05; // 5% commission
const MAX_ORDERS_PER_PLAYER = 5;
const ORDER_EXPIRES_HOURS = 48;

@Injectable()
export class MarketService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly resourcesService: ResourcesService,
  ) {}

  async createOrder(params: {
    profileId: string;
    settlementId: string;
    offerResource: string;
    offerAmount: number;
    wantResource: string;
    wantAmount: number;
  }) {
    const { profileId, settlementId, offerResource, offerAmount, wantResource, wantAmount } = params;

    if (offerResource === wantResource) throw new BadRequestException('Нельзя обменять ресурс на себя');
    if (offerAmount <= 0 || wantAmount <= 0) throw new BadRequestException('Количество должно быть > 0');

    const validResources = ['wood', 'stone', 'iron', 'food', 'silver'];
    if (!validResources.includes(offerResource) || !validResources.includes(wantResource)) {
      throw new BadRequestException('Неверный тип ресурса');
    }

    // Check active orders limit
    const existing = await this.db.query(
      `SELECT COUNT(*) FROM market_orders WHERE seller_id = $1 AND is_active = true`,
      [profileId],
    );
    if (parseInt(existing.rows[0].count) >= MAX_ORDERS_PER_PLAYER) {
      throw new BadRequestException(`Максимум ${MAX_ORDERS_PER_PLAYER} активных ордеров`);
    }

    // Check resources
    const hasEnough = await this.resourcesService.hasEnoughResources(settlementId, {
      [offerResource]: offerAmount,
    });
    if (!hasEnough) throw new BadRequestException('Недостаточно ресурсов для ордера');

    // Get world id
    const worldResult = await this.db.query(
      `SELECT world_id FROM settlements WHERE id = $1`, [settlementId]
    );
    const worldId = worldResult.rows[0]?.world_id;

    // Lock resources (deduct from settlement)
    await this.resourcesService.deductResources(settlementId, { [offerResource]: offerAmount });

    const expiresAt = new Date(Date.now() + ORDER_EXPIRES_HOURS * 3600000);

    const result = await this.db.query(
      `INSERT INTO market_orders
         (world_id, seller_id, origin_settlement_id, offer_resource, offer_amount,
          want_resource, want_amount, expires_at, delivery_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,4) RETURNING *`,
      [worldId, profileId, settlementId, offerResource, offerAmount, wantResource, wantAmount, expiresAt],
    );

    return result.rows[0];
  }

  async fulfillOrder(buyerProfileId: string, buyerSettlementId: string, orderId: string) {
    const orderResult = await this.db.query(
      `SELECT * FROM market_orders WHERE id = $1 AND is_active = true AND is_fulfilled = false`,
      [orderId],
    );
    if (!orderResult.rows.length) throw new BadRequestException('Ордер не найден или уже выполнен');
    const order = orderResult.rows[0];

    if (order.seller_id === buyerProfileId) throw new BadRequestException('Нельзя купить у себя');

    // Check buyer has wanted resources + fee
    const fee = Math.ceil(order.want_amount * MARKET_FEE);
    const totalNeeded = order.want_amount + fee;

    const hasEnough = await this.resourcesService.hasEnoughResources(buyerSettlementId, {
      [order.want_resource]: totalNeeded,
    });
    if (!hasEnough) throw new BadRequestException(`Нужно ${totalNeeded} ${order.want_resource} (включая 5% комиссию)`);

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Deduct from buyer
      await client.query(
        `UPDATE settlement_resources
         SET ${order.want_resource} = GREATEST(0, ${order.want_resource} - $1)
         WHERE settlement_id = $2`,
        [totalNeeded, buyerSettlementId],
      );

      // Give offered resource to buyer
      await client.query(
        `UPDATE settlement_resources
         SET ${order.offer_resource} = LEAST(${order.offer_resource} + $1, ${order.offer_resource}_limit)
         WHERE settlement_id = $2`,
        [order.offer_amount, buyerSettlementId],
      );

      // Give wanted resource to seller (minus fee goes to "world bank" / just disappears)
      const sellerSettlement = await client.query(
        `SELECT id FROM settlements WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [order.seller_id],
      );
      if (sellerSettlement.rows.length) {
        await client.query(
          `UPDATE settlement_resources
           SET ${order.want_resource} = LEAST(${order.want_resource} + $1, ${order.want_resource}_limit)
           WHERE settlement_id = $2`,
          [order.want_amount, sellerSettlement.rows[0].id],
        );
      }

      // Mark fulfilled
      await client.query(
        `UPDATE market_orders
         SET is_active = false, is_fulfilled = true, buyer_id = $1, fulfilled_at = NOW()
         WHERE id = $2`,
        [buyerProfileId, orderId],
      );

      // Notify seller
      await client.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'trade_arrived', $2, $3, $4)`,
        [
          order.seller_id,
          '💰 Сделка на рынке!',
          `Ваш ордер выполнен: +${order.want_amount} ${order.want_resource}`,
          JSON.stringify({ orderId }),
        ],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async cancelOrder(profileId: string, orderId: string) {
    const order = await this.db.query(
      `SELECT * FROM market_orders WHERE id = $1 AND seller_id = $2 AND is_active = true`,
      [orderId, profileId],
    );
    if (!order.rows.length) throw new BadRequestException('Ордер не найден');
    const o = order.rows[0];

    // Refund offer resources
    const sellerSettlement = await this.db.query(
      `SELECT id FROM settlements WHERE owner_id = $1 LIMIT 1`, [profileId]
    );
    if (sellerSettlement.rows.length) {
      await this.db.query(
        `UPDATE settlement_resources
         SET ${o.offer_resource} = LEAST(${o.offer_resource} + $1, ${o.offer_resource}_limit)
         WHERE settlement_id = $2`,
        [o.offer_amount, sellerSettlement.rows[0].id],
      );
    }

    await this.db.query(
      `UPDATE market_orders SET is_active = false WHERE id = $1`, [orderId]
    );
    return { success: true };
  }

  async getOrders(worldId: string, filters?: { resource?: string; page?: number }) {
    const page = filters?.page || 1;
    const offset = (page - 1) * 30;
    const whereResource = filters?.resource
      ? `AND (mo.offer_resource = '${filters.resource}' OR mo.want_resource = '${filters.resource}')`
      : '';

    const result = await this.db.query(
      `SELECT mo.*, pp.nickname as seller_name
       FROM market_orders mo
       JOIN player_profiles pp ON pp.id = mo.seller_id
       WHERE mo.world_id = $1 AND mo.is_active = true ${whereResource}
       ORDER BY mo.created_at DESC
       LIMIT 30 OFFSET $2`,
      [worldId, offset],
    );

    const count = await this.db.query(
      `SELECT COUNT(*) FROM market_orders WHERE world_id = $1 AND is_active = true`, [worldId]
    );

    return { orders: result.rows, total: parseInt(count.rows[0].count), page };
  }

  async getMyOrders(profileId: string) {
    const result = await this.db.query(
      `SELECT * FROM market_orders
       WHERE seller_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [profileId],
    );
    return result.rows;
  }

  // Auto-cancel and refund expired orders
  @Cron('0 * * * *')
  async expireOrders() {
    const expired = await this.db.query(
      `SELECT * FROM market_orders WHERE is_active = true AND expires_at < NOW()`
    );

    for (const order of expired.rows) {
      const settlement = await this.db.query(
        `SELECT id FROM settlements WHERE owner_id = $1 LIMIT 1`, [order.seller_id]
      );
      if (settlement.rows.length) {
        await this.db.query(
          `UPDATE settlement_resources
           SET ${order.offer_resource} = LEAST(${order.offer_resource} + $1, ${order.offer_resource}_limit)
           WHERE settlement_id = $2`,
          [order.offer_amount, settlement.rows[0].id],
        );
      }
      await this.db.query(
        `UPDATE market_orders SET is_active = false WHERE id = $1`, [order.id]
      );
    }
  }
}
