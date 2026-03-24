import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';

export interface ArmyComposition {
  [unitType: string]: number;
}

export interface CombatResult {
  attackerWon: boolean;
  attackerLosses: ArmyComposition;
  defenderLosses: ArmyComposition;
  resourcesLooted: { wood: number; stone: number; iron: number; food: number; silver: number };
  wallDamage: number;
  loyaltyReduction: number;
  captureSuccess: boolean;
  battleLog: string[];
  attackerSurvivors: ArmyComposition;
  defenderSurvivors: ArmyComposition;
}

@Injectable()
export class CombatEngine {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  // ============================================================
  // MAIN BATTLE CALCULATION
  // ============================================================
  calculateBattle(params: {
    attackerUnits: ArmyComposition;
    defenderUnits: ArmyComposition;
    wallLevel: number;
    attackerMorale: number;
    defenderMorale: number;
    biome: string;
    nightBonus: boolean;
    defenderResources: { wood: number; stone: number; iron: number; food: number; silver: number };
    captureAttempt: boolean;
    worldConfig: any;
  }): CombatResult {
    const gc = this.config.get('game');
    const combatCfg = gc.combat;
    const log: string[] = [];

    // --- Step 1: Calculate raw attack and defense power ---
    let totalAttack = 0;
    let totalDefenseInfantry = 0;
    let totalDefenseCavalry = 0;
    let totalDefenseSiege = 0;

    for (const [unitType, qty] of Object.entries(params.attackerUnits)) {
      if (!qty || qty <= 0) continue;
      const cfg = gc.units[unitType];
      if (!cfg) continue;
      totalAttack += cfg.attack * qty;
    }

    for (const [unitType, qty] of Object.entries(params.defenderUnits)) {
      if (!qty || qty <= 0) continue;
      const cfg = gc.units[unitType];
      if (!cfg) continue;
      totalDefenseInfantry += cfg.defense_infantry * qty;
      totalDefenseCavalry  += cfg.defense_cavalry  * qty;
      totalDefenseSiege    += cfg.defense_siege    * qty;
    }

    // Use average defense weighted by attacker composition
    const infantryRatio  = this.getUnitCategoryRatio(params.attackerUnits, 'infantry',  gc);
    const cavalryRatio   = this.getUnitCategoryRatio(params.attackerUnits, 'cavalry',   gc);
    const siegeRatio     = this.getUnitCategoryRatio(params.attackerUnits, 'siege',      gc);

    let totalDefense =
      totalDefenseInfantry * infantryRatio +
      totalDefenseCavalry  * cavalryRatio  +
      totalDefenseSiege    * siegeRatio;

    log.push(`Атака: ${Math.round(totalAttack)} | Защита: ${Math.round(totalDefense)}`);

    // --- Step 2: Apply modifiers ---

    // Morale bonus
    const attackMoraleBonus  = 1 + (params.attackerMorale - 100) * combatCfg.morale_attack_bonus_per_point;
    const defenseMoraleBonus = 1 + (params.defenderMorale - 100) * combatCfg.morale_defense_bonus_per_point;
    totalAttack  *= Math.max(0.5, attackMoraleBonus);
    totalDefense *= Math.max(0.5, defenseMoraleBonus);
    log.push(`После морали — Атака: ${Math.round(totalAttack)} | Защита: ${Math.round(totalDefense)}`);

    // Wall bonus
    const wallBonus = 1 + params.wallLevel * combatCfg.wall_defense_per_level;
    totalDefense *= wallBonus;
    if (params.wallLevel > 0) log.push(`Стена Ур.${params.wallLevel} даёт +${Math.round((wallBonus - 1) * 100)}% к защите`);

    // Biome bonus
    const biomeConfig = combatCfg.biome_bonuses[params.biome] || {};
    if (biomeConfig.defense) {
      totalDefense *= (1 + biomeConfig.defense);
      log.push(`Биом ${params.biome}: +${biomeConfig.defense * 100}% к защите`);
    }
    if (biomeConfig.attack_penalty) {
      totalAttack *= (1 - biomeConfig.attack_penalty);
    }

    // Night bonus
    if (params.nightBonus && params.worldConfig?.night_bonus_enabled) {
      totalDefense *= (1 + params.worldConfig.night_defense_bonus);
      log.push(`Ночной бонус: +${params.worldConfig.night_defense_bonus * 100}% к защите`);
    }

    // --- Step 3: Calculate losses ---
    const total = totalAttack + totalDefense;
    if (total <= 0) {
      return this.emptyResult(params.attackerUnits, params.defenderUnits);
    }

    const attackerLossRatio = Math.min(
      combatCfg.max_loss_ratio,
      Math.max(combatCfg.min_loss_ratio, totalDefense / total),
    );
    const defenderLossRatio = Math.min(
      combatCfg.max_loss_ratio,
      Math.max(combatCfg.min_loss_ratio, totalAttack / total),
    );

    const attackerLosses  = this.applyLosses(params.attackerUnits, attackerLossRatio);
    const defenderLosses  = this.applyLosses(params.defenderUnits, defenderLossRatio);
    const attackerSurvivors = this.subtractLosses(params.attackerUnits, attackerLosses);
    const defenderSurvivors = this.subtractLosses(params.defenderUnits, defenderLosses);

    const attackerWon = defenderLossRatio > attackerLossRatio;
    log.push(attackerWon ? '⚔ Атакующий ПОБЕДИЛ' : '🛡 Защитник ВЫСТОЯЛ');
    log.push(`Потери атакующего: ${Math.round(attackerLossRatio * 100)}% | Потери защитника: ${Math.round(defenderLossRatio * 100)}%`);

    // --- Step 4: Loot ---
    let resourcesLooted = { wood: 0, stone: 0, iron: 0, food: 0, silver: 0 };
    if (attackerWon) {
      const carryCapacity = this.calculateCarryCapacity(attackerSurvivors, gc);
      const lootPct = combatCfg.loot_base_percent;
      const protectedPct = combatCfg.loot_protected_percent;

      let remaining = carryCapacity;
      for (const res of ['silver', 'iron', 'food', 'stone', 'wood'] as const) {
        if (remaining <= 0) break;
        const available = Math.floor(params.defenderResources[res] * (lootPct - protectedPct));
        const looted = Math.min(available, remaining);
        resourcesLooted[res] = Math.max(0, looted);
        remaining -= looted;
      }
      log.push(`Захвачено ресурсов: ${JSON.stringify(resourcesLooted)}`);
    }

    // --- Step 5: Wall damage (catapults) ---
    let wallDamage = 0;
    const catapults = params.attackerUnits['catapult'] || 0;
    if (catapults > 0 && attackerWon) {
      wallDamage = Math.min(params.wallLevel, Math.floor(catapults / 50));
      if (wallDamage > 0) log.push(`Катапульты разрушили ${wallDamage} уровней стены`);
    }

    // --- Step 6: Loyalty reduction ---
    let loyaltyReduction = 0;
    let captureSuccess = false;
    if (params.captureAttempt && attackerWon) {
      const lords = params.attackerUnits['lord'] || 0;
      loyaltyReduction = lords * combatCfg.loyalty_per_lord;
      log.push(`Наместники снижают лояльность на ${loyaltyReduction}`);
    }

    return {
      attackerWon,
      attackerLosses,
      defenderLosses,
      resourcesLooted,
      wallDamage,
      loyaltyReduction,
      captureSuccess,
      battleLog: log,
      attackerSurvivors,
      defenderSurvivors,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private getUnitCategoryRatio(units: ArmyComposition, category: string, gc: any): number {
    let total = 0, catTotal = 0;
    for (const [type, qty] of Object.entries(units)) {
      if (!qty) continue;
      const cfg = gc.units[type];
      if (!cfg) continue;
      total += qty;
      if (cfg.category?.includes(category)) catTotal += qty;
    }
    return total > 0 ? catTotal / total : 0.33;
  }

  private applyLosses(units: ArmyComposition, ratio: number): ArmyComposition {
    const losses: ArmyComposition = {};
    for (const [type, qty] of Object.entries(units)) {
      losses[type] = Math.ceil(qty * ratio);
    }
    return losses;
  }

  private subtractLosses(units: ArmyComposition, losses: ArmyComposition): ArmyComposition {
    const survivors: ArmyComposition = {};
    for (const [type, qty] of Object.entries(units)) {
      survivors[type] = Math.max(0, qty - (losses[type] || 0));
    }
    return survivors;
  }

  private calculateCarryCapacity(survivors: ArmyComposition, gc: any): number {
    let cap = 0;
    for (const [type, qty] of Object.entries(survivors)) {
      const cfg = gc.units[type];
      if (cfg) cap += (cfg.carry_capacity || 0) * qty;
    }
    return cap;
  }

  private emptyResult(attackerUnits: ArmyComposition, defenderUnits: ArmyComposition): CombatResult {
    return {
      attackerWon: false,
      attackerLosses: {}, defenderLosses: {},
      resourcesLooted: { wood: 0, stone: 0, iron: 0, food: 0, silver: 0 },
      wallDamage: 0, loyaltyReduction: 0, captureSuccess: false,
      battleLog: ['Нет войск для боя'],
      attackerSurvivors: attackerUnits, defenderSurvivors: defenderUnits,
    };
  }
}
