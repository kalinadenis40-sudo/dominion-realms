import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { CombatEngine } from './combat.engine';

@Injectable()
export class CombatService {
  private readonly logger = new Logger('CombatService');

  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly engine: CombatEngine,
  ) {}

  async processCombat(movementId: string) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Load movement
      const mvResult = await client.query(
        `SELECT m.*, s.owner_id as attacker_owner,
                s.world_id,
                ts.id as target_id, ts.owner_id as defender_owner,
                ts.loyalty, ts.morale as def_morale,
                sr.wood, sr.stone, sr.iron, sr.food, sr.silver,
                t.biome,
                sb.level as wall_level,
                wc.night_bonus_enabled, wc.night_start_hour, wc.night_end_hour,
                wc.night_defense_bonus, wc.loyalty_capture_threshold,
                wc.loot_base_percent, wc.loot_protected_percent
         FROM movements m
         JOIN settlements s ON s.id = m.origin_settlement_id
         JOIN settlements ts ON ts.id = m.target_settlement_id
         JOIN settlement_resources sr ON sr.settlement_id = ts.id
         JOIN tiles t ON t.id = ts.tile_id
         JOIN worlds w ON w.id = s.world_id
         JOIN world_configs wc ON wc.world_id = w.id
         LEFT JOIN settlement_buildings sb ON sb.settlement_id = ts.id AND sb.building_type = 'wall'
         WHERE m.id = $1`,
        [movementId],
      );

      if (!mvResult.rows.length) throw new Error('Movement not found');
      const mv = mvResult.rows[0];

      // Get attacker morale
      const atkMoraleResult = await client.query(
        `SELECT morale FROM settlements WHERE id = $1`, [mv.origin_settlement_id]
      );
      const attackerMorale = atkMoraleResult.rows[0]?.morale ?? 100;

      // Get defender units (garrison)
      const defUnitsResult = await client.query(
        `SELECT unit_type, in_garrison as quantity FROM settlement_units
         WHERE settlement_id = $1 AND in_garrison > 0`,
        [mv.target_settlement_id],
      );
      const defenderUnits: Record<string, number> = {};
      for (const row of defUnitsResult.rows) {
        defenderUnits[row.unit_type] = row.quantity;
      }

      // Night bonus check
      const hour = new Date().getUTCHours();
      const nightBonus =
        mv.night_bonus_enabled &&
        (hour >= mv.night_start_hour || hour < mv.night_end_hour);

      // Run battle
      const result = this.engine.calculateBattle({
        attackerUnits: mv.units,
        defenderUnits,
        wallLevel: mv.wall_level || 0,
        attackerMorale,
        defenderMorale: mv.def_morale,
        biome: mv.biome,
        nightBonus,
        defenderResources: { wood: mv.wood, stone: mv.stone, iron: mv.iron, food: mv.food, silver: mv.silver },
        captureAttempt: mv.type === 'capture',
        worldConfig: {
          night_bonus_enabled: mv.night_bonus_enabled,
          night_defense_bonus: mv.night_defense_bonus,
          loyalty_capture_threshold: mv.loyalty_capture_threshold,
        },
      });

      // Save combat record
      const combatResult = await client.query(
        `INSERT INTO combats
           (world_id, movement_id, attacker_id, defender_id, settlement_id,
            attacker_units, defender_units,
            wall_level, morale_attacker, morale_defender, biome, night_bonus,
            attacker_losses, defender_losses, resources_looted,
            wall_damage, loyalty_reduction,
            attacker_won, capture_attempt, capture_success, battle_log)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id`,
        [
          mv.world_id, movementId, mv.attacker_owner, mv.defender_owner, mv.target_settlement_id,
          JSON.stringify(mv.units), JSON.stringify(defenderUnits),
          mv.wall_level || 0, attackerMorale, mv.def_morale, mv.biome, nightBonus,
          JSON.stringify(result.attackerLosses), JSON.stringify(result.defenderLosses),
          JSON.stringify(result.resourcesLooted),
          result.wallDamage, result.loyaltyReduction,
          result.attackerWon, mv.type === 'capture', result.captureSuccess,
          JSON.stringify(result.battleLog),
        ],
      );
      const combatId = combatResult.rows[0].id;

      // Apply attacker losses
      for (const [unitType, lost] of Object.entries(result.attackerLosses)) {
        if (!lost) continue;
        await client.query(
          `UPDATE settlement_units
           SET quantity = GREATEST(0, quantity - $1),
               in_garrison = GREATEST(0, in_garrison - $1)
           WHERE settlement_id = $2 AND unit_type = $3`,
          [lost, mv.origin_settlement_id, unitType],
        );
      }

      // Apply defender losses
      for (const [unitType, lost] of Object.entries(result.defenderLosses)) {
        if (!lost) continue;
        await client.query(
          `UPDATE settlement_units
           SET quantity = GREATEST(0, quantity - $1),
               in_garrison = GREATEST(0, in_garrison - $1)
           WHERE settlement_id = $2 AND unit_type = $3`,
          [lost, mv.target_settlement_id, unitType],
        );
      }

      // Apply loot: remove from defender, return with attacker
      const loot = result.resourcesLooted;
      if (result.attackerWon) {
        await client.query(
          `UPDATE settlement_resources
           SET wood   = GREATEST(0, wood   - $1),
               stone  = GREATEST(0, stone  - $2),
               iron   = GREATEST(0, iron   - $3),
               food   = GREATEST(0, food   - $4),
               silver = GREATEST(0, silver - $5)
           WHERE settlement_id = $6`,
          [loot.wood, loot.stone, loot.iron, loot.food, loot.silver, mv.target_settlement_id],
        );
      }

      // Apply wall damage
      if (result.wallDamage > 0) {
        await client.query(
          `UPDATE settlement_buildings
           SET level = GREATEST(0, level - $1)
           WHERE settlement_id = $2 AND building_type = 'wall'`,
          [result.wallDamage, mv.target_settlement_id],
        );
      }

      // Apply loyalty reduction
      if (result.loyaltyReduction > 0) {
        await client.query(
          `UPDATE settlements
           SET loyalty = GREATEST(0, loyalty - $1)
           WHERE id = $2`,
          [result.loyaltyReduction, mv.target_settlement_id],
        );

        // Check capture
        const newLoyaltyResult = await client.query(
          `SELECT loyalty FROM settlements WHERE id = $1`, [mv.target_settlement_id]
        );
        const newLoyalty = newLoyaltyResult.rows[0]?.loyalty ?? 100;
        if (newLoyalty <= mv.loyalty_capture_threshold && result.attackerWon) {
          await this.captureSettlement(client, mv.target_settlement_id, mv.attacker_owner, combatId);
          result.captureSuccess = true;
        }
      }

      // Update movement: set return trip with looted resources
      const returnTime = new Date(Date.now() + (mv.arrives_at - new Date(mv.departs_at).getTime()));
      await client.query(
        `UPDATE movements
         SET status = $1, combat_id = $2,
             resources = $3,
             return_arrives_at = $4, units = $5
         WHERE id = $6`,
        [
          'returning',
          combatId,
          JSON.stringify(result.resourcesLooted),
          new Date(Date.now() + (new Date(mv.arrives_at).getTime() - new Date(mv.departs_at).getTime())),
          JSON.stringify(result.attackerSurvivors),
          movementId,
        ],
      );

      // Notify defender
      if (mv.defender_owner) {
        await client.query(
          `INSERT INTO notifications (player_id, type, title, body, data)
           VALUES ($1, 'attack_arrived', $2, $3, $4)`,
          [
            mv.defender_owner,
            result.attackerWon ? '⚔ Ваше поселение атаковано!' : '🛡 Атака отражена!',
            `Потери: ${Object.values(result.defenderLosses).reduce((a: any, b: any) => a + b, 0)} воинов`,
            JSON.stringify({ combatId, attackerWon: result.attackerWon }),
          ],
        );
      }

      // Notify attacker
      await client.query(
        `INSERT INTO notifications (player_id, type, title, body, data)
         VALUES ($1, 'attack_arrived', $2, $3, $4)`,
        [
          mv.attacker_owner,
          result.attackerWon ? '⚔ Победа!' : '⚔ Поражение',
          `Ваши потери: ${Object.values(result.attackerLosses).reduce((a: any, b: any) => a + b, 0)} воинов`,
          JSON.stringify({ combatId, attackerWon: result.attackerWon }),
        ],
      );

      // Create reports for both players
      await this.createCombatReports(client, combatId, mv, result);

      await client.query('COMMIT');
      this.logger.log(`Combat processed: ${movementId}, winner: ${result.attackerWon ? 'attacker' : 'defender'}`);
      return result;

    } catch (e) {
      await client.query('ROLLBACK');
      this.logger.error(`Combat failed: ${e.message}`);
      throw e;
    } finally {
      client.release();
    }
  }

  private async captureSettlement(client: any, settlementId: string, newOwnerId: string, combatId: string) {
    // Transfer ownership
    await client.query(
      `UPDATE settlements
       SET owner_id = $1, loyalty = 20, morale = 50,
           capture_in_progress = false
       WHERE id = $2`,
      [newOwnerId, settlementId],
    );

    // Update player settlement counts
    await client.query(
      `UPDATE player_profiles SET total_settlements = total_settlements + 1 WHERE id = $1`,
      [newOwnerId],
    );

    this.logger.log(`Settlement ${settlementId} captured by ${newOwnerId}`);
  }

  private async createCombatReports(client: any, combatId: string, mv: any, result: any) {
    const worldId = mv.world_id;

    const reportData = {
      attackerWon: result.attackerWon,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      resourcesLooted: result.resourcesLooted,
      wallDamage: result.wallDamage,
      loyaltyReduction: result.loyaltyReduction,
      captureSuccess: result.captureSuccess,
      battleLog: result.battleLog,
    };

    // Report for attacker
    await client.query(
      `INSERT INTO reports (world_id, owner_id, type, title, summary, full_data, combat_id)
       VALUES ($1, $2, 'attack', $3, $4, $5, $6)`,
      [
        worldId, mv.attacker_owner,
        result.attackerWon ? '⚔ Победа в бою' : '⚔ Поражение в бою',
        JSON.stringify({ result: result.attackerWon ? 'won' : 'lost', losses: result.attackerLosses }),
        JSON.stringify(reportData),
        combatId,
      ],
    );

    // Report for defender
    if (mv.defender_owner) {
      await client.query(
        `INSERT INTO reports (world_id, owner_id, type, title, summary, full_data, combat_id)
         VALUES ($1, $2, 'defense', $3, $4, $5, $6)`,
        [
          worldId, mv.defender_owner,
          result.attackerWon ? '🛡 Поселение захвачено' : '🛡 Атака отражена',
          JSON.stringify({ result: result.attackerWon ? 'lost' : 'won', losses: result.defenderLosses }),
          JSON.stringify(reportData),
          combatId,
        ],
      );
    }
  }
}
