export const ACHIEVEMENT_DEFINITIONS: Record<string, {
  title: string; description: string; icon: string;
  condition: Record<string, number>; rarity: 'common'|'rare'|'epic'|'legendary';
}> = {
  // Economy
  economist_i:   { title: 'Экономист I',   description: 'Накопить 10,000 серебра',      icon: '💰', condition: { silver_total: 10000 },   rarity: 'common' },
  economist_ii:  { title: 'Экономист II',  description: 'Накопить 100,000 серебра',     icon: '💰', condition: { silver_total: 100000 },  rarity: 'rare' },
  economist_iii: { title: 'Экономист III', description: 'Накопить 1,000,000 серебра',   icon: '💰', condition: { silver_total: 1000000 }, rarity: 'epic' },

  // Military
  warrior_i:     { title: 'Воин',       description: 'Победить в 10 боях',    icon: '⚔️', condition: { victories: 10 },   rarity: 'common' },
  warrior_ii:    { title: 'Ветеран',    description: 'Победить в 50 боях',    icon: '⚔️', condition: { victories: 50 },   rarity: 'rare' },
  warrior_iii:   { title: 'Маршал',     description: 'Победить в 200 боях',   icon: '⚔️', condition: { victories: 200 },  rarity: 'epic' },
  conqueror:     { title: 'Завоеватель', description: 'Захватить поселение',   icon: '🏰', condition: { captures: 1 },     rarity: 'rare' },
  empire:        { title: 'Империя',     description: 'Захватить 5 поселений', icon: '🏰', condition: { captures: 5 },     rarity: 'epic' },

  // Buildings
  builder_i:     { title: 'Строитель',   description: 'Улучшить 10 зданий',   icon: '🏛', condition: { buildings_upgraded: 10 },  rarity: 'common' },
  architect:     { title: 'Архитектор',  description: 'Улучшить 50 зданий',   icon: '🏛', condition: { buildings_upgraded: 50 },  rarity: 'rare' },
  master_builder:{ title: 'Мастер строитель', description: 'Улучшить 100 зданий', icon: '🏛', condition: { buildings_upgraded: 100 }, rarity: 'epic' },

  // Scouting
  scout_i:       { title: 'Разведчик',  description: 'Провести 10 разведок',   icon: '🔍', condition: { scouts_sent: 10 }, rarity: 'common' },
  spy_master:    { title: 'Шпионмастер', description: 'Провести 50 разведок',  icon: '🔍', condition: { scouts_sent: 50 }, rarity: 'rare' },

  // Social
  diplomat_i:    { title: 'Дипломат',   description: 'Вступить в альянс',          icon: '🤝', condition: { in_alliance: 1 },      rarity: 'common' },
  alliance_war:  { title: 'Война альянсов', description: 'Объявить войну альянсом', icon: '⚔️', condition: { wars_declared: 1 },    rarity: 'rare' },

  // Research
  researcher_i:  { title: 'Учёный',    description: 'Изучить 10 технологий',   icon: '📜', condition: { research_levels: 10 },  rarity: 'common' },
  sage:          { title: 'Мудрец',    description: 'Изучить 30 технологий',   icon: '📜', condition: { research_levels: 30 },  rarity: 'rare' },

  // Special
  first_blood:   { title: 'Первая кровь', description: 'Выиграть первый бой',  icon: '🩸', condition: { victories: 1 },   rarity: 'common' },
  season_king:   { title: 'Король сезона', description: 'Занять #1 в рейтинге', icon: '👑', condition: { rank_1: 1 },      rarity: 'legendary' },
};
