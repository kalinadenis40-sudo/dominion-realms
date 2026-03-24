export const gameConfig = () => ({
  game: {
    // ============================================================
    // BUILDINGS CONFIG
    // Каждое здание: maxLevel, baseCost, timeBase, populationUsed, bonus
    // ============================================================
    buildings: {
      main_building: {
        maxLevel: 20,
        baseCost: { wood: 80, stone: 80, iron: 0, food: 0, silver: 0 },
        costMultiplier: 1.6,
        timeBase: 120, // seconds at level 1
        timeMultiplier: 1.6,
        populationUsed: 0,
        bonus: 'unlocks_other_buildings',
      },
      sawmill: {
        maxLevel: 20,
        baseCost: { wood: 60, stone: 30, iron: 10, food: 0, silver: 0 },
        costMultiplier: 1.5,
        timeBase: 90,
        timeMultiplier: 1.5,
        populationUsed: 5,
        bonus: 'wood_production',
        bonusPerLevel: 30, // +30 wood/hour per level
      },
      quarry: {
        maxLevel: 20,
        baseCost: { wood: 40, stone: 20, iron: 15, food: 0, silver: 0 },
        costMultiplier: 1.5,
        timeBase: 90,
        timeMultiplier: 1.5,
        populationUsed: 5,
        bonus: 'stone_production',
        bonusPerLevel: 20,
      },
      iron_mine: {
        maxLevel: 20,
        baseCost: { wood: 50, stone: 40, iron: 0, food: 0, silver: 0 },
        costMultiplier: 1.55,
        timeBase: 100,
        timeMultiplier: 1.55,
        populationUsed: 7,
        bonus: 'iron_production',
        bonusPerLevel: 15,
      },
      farm: {
        maxLevel: 20,
        baseCost: { wood: 70, stone: 20, iron: 5, food: 0, silver: 0 },
        costMultiplier: 1.45,
        timeBase: 80,
        timeMultiplier: 1.45,
        populationUsed: 3,
        bonus: 'population_limit',
        bonusPerLevel: 100, // +100 population limit per level
      },
      warehouse: {
        maxLevel: 20,
        baseCost: { wood: 100, stone: 60, iron: 20, food: 0, silver: 0 },
        costMultiplier: 1.5,
        timeBase: 150,
        timeMultiplier: 1.5,
        populationUsed: 2,
        bonus: 'storage_limit',
        bonusPerLevel: 1000,
      },
      wall: {
        maxLevel: 20,
        baseCost: { wood: 50, stone: 100, iron: 50, food: 0, silver: 0 },
        costMultiplier: 1.7,
        timeBase: 200,
        timeMultiplier: 1.7,
        populationUsed: 0,
        bonus: 'defense_bonus',
        bonusPerLevel: 0.03, // +3% defense per level
      },
      barracks: {
        maxLevel: 20,
        baseCost: { wood: 80, stone: 40, iron: 30, food: 0, silver: 0 },
        costMultiplier: 1.55,
        timeBase: 120,
        timeMultiplier: 1.55,
        populationUsed: 8,
        bonus: 'train_speed',
        bonusPerLevel: 0.02,
      },
      stable: {
        maxLevel: 20,
        baseCost: { wood: 100, stone: 50, iron: 60, food: 0, silver: 0 },
        costMultiplier: 1.6,
        timeBase: 160,
        timeMultiplier: 1.6,
        populationUsed: 10,
        bonus: 'cavalry_units',
        requires: { barracks: 5 },
      },
      workshop: {
        maxLevel: 20,
        baseCost: { wood: 120, stone: 80, iron: 100, food: 0, silver: 0 },
        costMultiplier: 1.65,
        timeBase: 200,
        timeMultiplier: 1.65,
        populationUsed: 12,
        bonus: 'siege_units',
        requires: { barracks: 10, stable: 5 },
      },
      academy: {
        maxLevel: 20,
        baseCost: { wood: 200, stone: 150, iron: 100, food: 0, silver: 50 },
        costMultiplier: 1.7,
        timeBase: 300,
        timeMultiplier: 1.7,
        populationUsed: 15,
        bonus: 'research',
        requires: { main_building: 5 },
      },
      market: {
        maxLevel: 10,
        baseCost: { wood: 100, stone: 100, iron: 50, food: 0, silver: 20 },
        costMultiplier: 1.5,
        timeBase: 180,
        timeMultiplier: 1.5,
        populationUsed: 10,
        bonus: 'traders_count',
        bonusPerLevel: 2,
        requires: { main_building: 3 },
      },
      watchtower: {
        maxLevel: 20,
        baseCost: { wood: 50, stone: 50, iron: 20, food: 0, silver: 0 },
        costMultiplier: 1.4,
        timeBase: 100,
        timeMultiplier: 1.4,
        populationUsed: 5,
        bonus: 'scout_defense',
        bonusPerLevel: 0.05,
      },
      palace: {
        maxLevel: 10,
        baseCost: { wood: 500, stone: 500, iron: 300, food: 0, silver: 200 },
        costMultiplier: 2.0,
        timeBase: 1200,
        timeMultiplier: 2.0,
        populationUsed: 30,
        bonus: 'capture_ability',
        requires: { main_building: 15, academy: 5 },
      },
    },

    // ============================================================
    // UNITS CONFIG
    // ============================================================
    units: {
      spearman: {
        category: 'light_infantry',
        attack: 10,
        defense_infantry: 15,
        defense_cavalry: 45,
        defense_siege: 20,
        speed: 18, // minutes per 100 tiles
        carry_capacity: 25,
        population: 1,
        upkeep_food: 1,
        cost: { wood: 30, iron: 10, food: 5, silver: 0 },
        train_time: 300, // seconds
        requires: { barracks: 1 },
      },
      swordsman: {
        category: 'heavy_infantry',
        attack: 25,
        defense_infantry: 30,
        defense_cavalry: 25,
        defense_siege: 30,
        speed: 22,
        carry_capacity: 15,
        population: 1,
        upkeep_food: 1.2,
        cost: { wood: 30, iron: 35, food: 10, silver: 5 },
        train_time: 480,
        requires: { barracks: 3 },
      },
      axeman: {
        category: 'heavy_infantry',
        attack: 40,
        defense_infantry: 10,
        defense_cavalry: 5,
        defense_siege: 10,
        speed: 24,
        carry_capacity: 10,
        population: 1,
        upkeep_food: 1.5,
        cost: { wood: 10, iron: 50, food: 15, silver: 0 },
        train_time: 600,
        requires: { barracks: 5 },
      },
      archer: {
        category: 'ranged',
        attack: 15,
        defense_infantry: 25,
        defense_cavalry: 10,
        defense_siege: 15,
        speed: 20,
        carry_capacity: 20,
        population: 1,
        upkeep_food: 1,
        cost: { wood: 40, iron: 15, food: 5, silver: 0 },
        train_time: 420,
        requires: { barracks: 2 },
      },
      crossbowman: {
        category: 'ranged',
        attack: 30,
        defense_infantry: 35,
        defense_cavalry: 15,
        defense_siege: 20,
        speed: 25,
        carry_capacity: 15,
        population: 1,
        upkeep_food: 1.2,
        cost: { wood: 30, iron: 30, food: 10, silver: 10 },
        train_time: 720,
        requires: { barracks: 6 },
      },
      scout: {
        category: 'scout',
        attack: 0,
        defense_infantry: 2,
        defense_cavalry: 1,
        defense_siege: 1,
        speed: 9,
        carry_capacity: 0,
        population: 1,
        upkeep_food: 0.5,
        cost: { wood: 20, iron: 0, food: 0, silver: 20 },
        train_time: 180,
        requires: { barracks: 1 },
      },
      light_cavalry: {
        category: 'cavalry',
        attack: 60,
        defense_infantry: 30,
        defense_cavalry: 40,
        defense_siege: 25,
        speed: 10,
        carry_capacity: 80,
        population: 2,
        upkeep_food: 3,
        cost: { wood: 20, iron: 60, food: 30, silver: 0 },
        train_time: 900,
        requires: { stable: 1 },
      },
      heavy_cavalry: {
        category: 'cavalry',
        attack: 120,
        defense_infantry: 80,
        defense_cavalry: 100,
        defense_siege: 60,
        speed: 14,
        carry_capacity: 50,
        population: 3,
        upkeep_food: 6,
        cost: { wood: 30, iron: 120, food: 60, silver: 30 },
        train_time: 1800,
        requires: { stable: 5 },
      },
      catapult: {
        category: 'siege',
        attack: 50,
        defense_infantry: 10,
        defense_cavalry: 10,
        defense_siege: 100,
        speed: 40,
        carry_capacity: 0,
        population: 5,
        upkeep_food: 8,
        cost: { wood: 300, iron: 150, food: 50, silver: 100 },
        train_time: 3600,
        special: 'destroys_walls',
        requires: { workshop: 1 },
      },
      ram: {
        category: 'siege',
        attack: 2,
        defense_infantry: 20,
        defense_cavalry: 20,
        defense_siege: 50,
        speed: 35,
        carry_capacity: 0,
        population: 5,
        upkeep_food: 8,
        cost: { wood: 200, iron: 100, food: 50, silver: 50 },
        train_time: 2400,
        special: 'breaks_gates',
        requires: { workshop: 1 },
      },
      lord: {
        category: 'capture',
        attack: 5,
        defense_infantry: 40,
        defense_cavalry: 40,
        defense_siege: 40,
        speed: 30,
        carry_capacity: 0,
        population: 10,
        upkeep_food: 5,
        cost: { wood: 0, iron: 0, food: 0, silver: 500 },
        train_time: 7200,
        special: 'captures_settlement',
        requires: { palace: 1 },
      },
    },

    // ============================================================
    // COMBAT FORMULA CONFIG
    // ============================================================
    combat: {
      // Базовая формула: effectiveAttack = sum(unit.attack * quantity) * moraleMultiplier
      // Потери атакующего: attackerLossRatio = defenseTotal / (attackTotal + defenseTotal)
      // Потери защитника: defenderLossRatio = attackTotal / (attackTotal + defenseTotal)

      // Минимальный и максимальный шанс потерь (процент)
      min_loss_ratio: 0.01, // 1%
      max_loss_ratio: 0.99, // 99%

      // Бонус стены: каждый уровень стены даёт этот % к защите
      wall_defense_per_level: 0.03,

      // Мораль
      morale_attack_bonus_per_point: 0.001, // каждые 100 морали = +10% к атаке
      morale_defense_bonus_per_point: 0.001,

      // Биом
      biome_bonuses: {
        mountains: { defense: 0.2, speed_penalty: 0.3 },
        forest: { defense: 0.1, speed_penalty: 0.15 },
        swamp: { speed_penalty: 0.5, attack_penalty: 0.1 },
        plains: {},
        wasteland: { speed_penalty: 0.1 },
        tundra: { speed_penalty: 0.2 },
      },

      // Ночной бонус (если включён в world_config)
      night_defense_bonus: 0.1,

      // Лут при победе
      loot_base_percent: 0.5, // 50% от ресурсов, если победили
      loot_protected_percent: 0.25, // 25% ресурсов защищены всегда

      // Лояльность при захвате
      loyalty_per_lord: 20, // каждый лорд снимает 20 лояльности
      loyalty_recovery_per_hour: 1,
      capture_loyalty_threshold: 0,

      // Ронды боя (внутренний расчёт)
      max_battle_rounds: 3,
    },

    // ============================================================
    // RESOURCE PRODUCTION FORMULA
    // wood_per_hour = sawmill.level * building.bonusPerLevel * world.resource_speed
    // ============================================================
    resources: {
      base_production: {
        wood: 30,   // базовое производство без зданий
        stone: 20,
        iron: 10,
        food: 40,
        silver: 5,
      },
      tick_interval_ms: 60000, // каждую минуту
    },

    // ============================================================
    // RESEARCH CONFIG
    // ============================================================
    research: {
      faster_construction: {
        category: 'construction',
        maxLevel: 10,
        baseCost: { silver: 100, iron: 50 },
        costMultiplier: 1.5,
        timeBase: 600,
        bonus: 'build_speed',
        bonusPerLevel: 0.04,
        requires: { academy: 1 },
      },
      improved_forging: {
        category: 'military',
        maxLevel: 10,
        baseCost: { silver: 150, iron: 100 },
        costMultiplier: 1.6,
        timeBase: 900,
        bonus: 'unit_attack',
        bonusPerLevel: 0.05,
        requires: { academy: 3 },
      },
      long_range_scouting: {
        category: 'scouting',
        maxLevel: 5,
        baseCost: { silver: 200, iron: 50 },
        costMultiplier: 1.8,
        timeBase: 1200,
        bonus: 'scout_capacity',
        bonusPerLevel: 0.25,
        requires: { academy: 2, watchtower: 3 },
      },
      supply_trains: {
        category: 'logistics',
        maxLevel: 10,
        baseCost: { silver: 100, wood: 100 },
        costMultiplier: 1.5,
        timeBase: 800,
        bonus: 'carry_capacity',
        bonusPerLevel: 0.1,
        requires: { academy: 2 },
      },
    },
  },
});

export type GameConfig = ReturnType<typeof gameConfig>;
