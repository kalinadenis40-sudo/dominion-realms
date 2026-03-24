import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ResourcesService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // MAIN TICK — called every minute for all settlements
  // ============================================================
  async tickAllSettlements() {
    const settlements = await this.db.query(
      `SELECT sr.settlement_id, sr.last_tick_at,
              sr.wood, sr.stone, sr.iron, sr.food, sr.silver,
              sr.wood_limit, sr.stone_limit, sr.iron_limit, sr.food_limit, sr.silver_limit,
              sr.wood_per_hour, sr.stone_per_hour, sr.iron_per_hour,
              sr.food_per_hour, sr.silver_per_hour, sr.food_consumption_per_hour,
              wc.resource_speed
       FROM settlement_resources sr
       JOIN settlements s ON s.id = sr.settlement_id
       JOIN worlds w ON w.id = s.world_id
       JOIN world_configs wc ON wc.world_id = w.id
       WHERE s.owner_id IS NOT NULL`,
    );

    const now = new Date();

    for (const row of settlements.rows) {
      await this.tickSettlement(row, now);
    }
  }

  async tickSettlement(row: any, now: Date = new Date()) {
    const lastTick = new Date(row.last_tick_at);
    const elapsedHours = (now.getTime() - lastTick.getTime()) / 3600000;

    if (elapsedHours < 0.001) return; // Less than 3.6 seconds, skip

    const speed = parseFloat(row.resource_speed) || 1.0;

    // Calculate production
    const produce = (perHour: number) =>
      parseFloat(perHour) * elapsedHours * speed;

    const netFood = parseFloat(row.food_per_hour) - parseFloat(row.food_consumption_per_hour);

    const newWood   = Math.min(parseFloat(row.wood)   + produce(row.wood_per_hour),   parseFloat(row.wood_limit));
    const newStone  = Math.min(parseFloat(row.stone)  + produce(row.stone_per_hour),  parseFloat(row.stone_limit));
    const newIron   = Math.min(parseFloat(row.iron)   + produce(row.iron_per_hour),   parseFloat(row.iron_limit));
    const newFood   = Math.min(Math.max(parseFloat(row.food) + netFood * elapsedHours * speed, 0), parseFloat(row.food_limit));
    const newSilver = Math.min(parseFloat(row.silver) + produce(row.silver_per_hour), parseFloat(row.silver_limit));

    await this.db.query(
      `UPDATE settlement_resources
       SET wood = $1, stone = $2, iron = $3, food = $4, silver = $5,
           last_tick_at = $6, updated_at = NOW()
       WHERE settlement_id = $7`,
      [newWood, newStone, newIron, newFood, newSilver, now, row.settlement_id],
    );
  }

  // Recalculate production rates based on buildings
  async recalcProductionRates(settlementId: string) {
    const gc = this.config.get('game');
    const buildings = await this.db.query(
      `SELECT building_type, level FROM settlement_buildings
       WHERE settlement_id = $1 AND status = 'active'`,
      [settlementId],
    );

    const base = gc.resources.base_production;
    let wood = base.wood, stone = base.stone, iron = base.iron,
        food = base.food, silver = base.silver;

    for (const b of buildings.rows) {
      const cfg = gc.buildings[b.building_type];
      if (!cfg || !cfg.bonus || b.level === 0) continue;
      const bonus = (cfg.bonusPerLevel || 0) * b.level;
      if (cfg.bonus === 'wood_production')   wood   += bonus;
      if (cfg.bonus === 'stone_production')  stone  += bonus;
      if (cfg.bonus === 'iron_production')   iron   += bonus;
    }

    // Food: farm gives population limit, not food production directly
    // Food comes from base + farm bonus per level
    const farm = buildings.rows.find((b: any) => b.building_type === 'farm');
    if (farm) {
      const farmCfg = gc.buildings.farm;
      food = base.food + (farmCfg.bonusPerLevel || 0) * farm.level * 0.1;
    }

    // Calculate army food consumption
    const units = await this.db.query(
      `SELECT unit_type, quantity FROM settlement_units WHERE settlement_id = $1`,
      [settlementId],
    );
    let foodConsumption = 0;
    for (const u of units.rows) {
      const uCfg = gc.units[u.unit_type];
      if (uCfg) foodConsumption += (uCfg.upkeep_food || 0) * u.quantity;
    }

    // Storage limits from warehouse
    const warehouse = buildings.rows.find((b: any) => b.building_type === 'warehouse');
    const wLevel = warehouse?.level || 0;
    const warehouseCfg = gc.buildings.warehouse;
    const storageBonus = (warehouseCfg.bonusPerLevel || 0) * wLevel;
    const baseLimit = 2000;

    await this.db.query(
      `UPDATE settlement_resources
       SET wood_per_hour = $1, stone_per_hour = $2, iron_per_hour = $3,
           food_per_hour = $4, silver_per_hour = $5,
           food_consumption_per_hour = $6,
           wood_limit = $7, stone_limit = $7, iron_limit = $8,
           food_limit = $7, silver_limit = $9,
           updated_at = NOW()
       WHERE settlement_id = $10`,
      [
        wood, stone, iron, food, silver, foodConsumption,
        baseLimit + storageBonus,
        Math.floor((baseLimit + storageBonus) * 0.75),
        Math.floor((baseLimit + storageBonus) * 0.5),
        settlementId,
      ],
    );
  }

  // Deduct resources (used by buildings/training)
  async deductResources(settlementId: string, cost: {
    wood?: number; stone?: number; iron?: number; food?: number; silver?: number;
  }) {
    const sets: string[] = [];
    const params: any[] = [settlementId];
    let pi = 2;

    if (cost.wood)   { sets.push(`wood = wood - $${pi++}`);   params.push(cost.wood); }
    if (cost.stone)  { sets.push(`stone = stone - $${pi++}`); params.push(cost.stone); }
    if (cost.iron)   { sets.push(`iron = iron - $${pi++}`);   params.push(cost.iron); }
    if (cost.food)   { sets.push(`food = food - $${pi++}`);   params.push(cost.food); }
    if (cost.silver) { sets.push(`silver = silver - $${pi++}`); params.push(cost.silver); }

    if (!sets.length) return;

    await this.db.query(
      `UPDATE settlement_resources SET ${sets.join(', ')}, updated_at = NOW()
       WHERE settlement_id = $1`,
      params,
    );
  }

  async getResources(settlementId: string) {
    const result = await this.db.query(
      `SELECT * FROM settlement_resources WHERE settlement_id = $1`,
      [settlementId],
    );
    return result.rows[0];
  }

  // Check if settlement has enough resources
  async hasEnoughResources(settlementId: string, cost: {
    wood?: number; stone?: number; iron?: number; food?: number; silver?: number;
  }): Promise<boolean> {
    const res = await this.getResources(settlementId);
    if (!res) return false;
    if (cost.wood   && res.wood   < cost.wood)   return false;
    if (cost.stone  && res.stone  < cost.stone)  return false;
    if (cost.iron   && res.iron   < cost.iron)   return false;
    if (cost.food   && res.food   < cost.food)   return false;
    if (cost.silver && res.silver < cost.silver) return false;
    return true;
  }
}
