-- ============================================================
-- DOMINION REALMS — ПОЛНАЯ СХЕМА БД v1.0
-- PostgreSQL 16
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('player', 'moderator', 'gm', 'admin', 'super_admin');
CREATE TYPE settlement_type AS ENUM ('normal', 'fortified', 'trade', 'military', 'border_fortress', 'capital', 'neutral', 'ancient_citadel', 'vassal');
CREATE TYPE settlement_specialization AS ENUM ('economic', 'military', 'defensive', 'trade', 'research', 'mixed');
CREATE TYPE biome_type AS ENUM ('forest', 'plains', 'mountains', 'swamp', 'wasteland', 'tundra');
CREATE TYPE movement_type AS ENUM ('attack', 'support', 'scout', 'transport', 'colonize', 'capture', 'raid', 'reinforce');
CREATE TYPE movement_status AS ENUM ('traveling', 'arrived', 'returning', 'recalled', 'cancelled');
CREATE TYPE building_status AS ENUM ('active', 'damaged', 'destroyed', 'upgrading');
CREATE TYPE queue_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE diplomacy_type AS ENUM ('peace', 'truce', 'alliance', 'vassalage', 'war', 'trade_pact', 'passage');
CREATE TYPE report_type AS ENUM ('scout', 'attack', 'defense', 'transport', 'trade', 'system', 'capture');
CREATE TYPE alliance_role AS ENUM ('leader', 'deputy', 'diplomat', 'war_coordinator', 'recruiter', 'treasurer', 'member');
CREATE TYPE event_type AS ENUM ('invasion', 'comet', 'plague', 'harvest', 'gold_rush', 'storm', 'uprising', 'ancient_fortress', 'world_boss', 'seasonal');
CREATE TYPE research_category AS ENUM ('economy', 'military', 'scouting', 'construction', 'diplomacy', 'logistics', 'siege', 'defense');
CREATE TYPE notification_type AS ENUM ('attack_incoming', 'attack_arrived', 'building_complete', 'training_complete', 'scout_arrived', 'trade_arrived', 'alliance_message', 'event_start', 'capture_warning', 'support_arrived');

-- ============================================================
-- USERS & PROFILES
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'player',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verify_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    login_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE player_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(32) UNIQUE NOT NULL,
    avatar_url VARCHAR(512),
    frame_id VARCHAR(64),
    language VARCHAR(8) NOT NULL DEFAULT 'ru',
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    country_code VARCHAR(4),
    bio TEXT,
    -- Stats
    total_settlements INTEGER NOT NULL DEFAULT 0,
    total_victories INTEGER NOT NULL DEFAULT 0,
    total_defeats INTEGER NOT NULL DEFAULT 0,
    total_captures INTEGER NOT NULL DEFAULT 0,
    -- Rating
    power_rating INTEGER NOT NULL DEFAULT 0,
    economy_rating INTEGER NOT NULL DEFAULT 0,
    war_rating INTEGER NOT NULL DEFAULT 0,
    dev_rating INTEGER NOT NULL DEFAULT 0,
    -- Premium
    is_premium BOOLEAN NOT NULL DEFAULT false,
    premium_expires_at TIMESTAMPTZ,
    -- Settings
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_info VARCHAR(512),
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WORLDS
-- ============================================================

CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(32) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    is_registration_open BOOLEAN NOT NULL DEFAULT true,
    season_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    player_count INTEGER NOT NULL DEFAULT 0,
    max_players INTEGER NOT NULL DEFAULT 5000,
    map_size_x INTEGER NOT NULL DEFAULT 800,
    map_size_y INTEGER NOT NULL DEFAULT 800,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE world_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL UNIQUE REFERENCES worlds(id) ON DELETE CASCADE,
    -- Speed multipliers
    resource_speed NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    build_speed NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    train_speed NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    movement_speed NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    -- Protection
    newbie_shield_hours INTEGER NOT NULL DEFAULT 72,
    newbie_attack_protection_score INTEGER NOT NULL DEFAULT 1000,
    -- Combat
    wall_bonus_per_level NUMERIC(5,3) NOT NULL DEFAULT 0.03,
    morale_attack_bonus NUMERIC(5,3) NOT NULL DEFAULT 0.001,
    loyalty_capture_threshold INTEGER NOT NULL DEFAULT 20,
    -- Economy
    warehouse_overflow_protection NUMERIC(4,2) NOT NULL DEFAULT 0.25,
    max_loot_percent NUMERIC(4,2) NOT NULL DEFAULT 0.5,
    -- Alliance
    max_alliance_members INTEGER NOT NULL DEFAULT 30,
    alliance_gift_daily_limit INTEGER NOT NULL DEFAULT 5000,
    -- Events
    event_frequency_hours INTEGER NOT NULL DEFAULT 24,
    -- Night bonus (optional)
    night_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
    night_bonus_defense NUMERIC(4,2) NOT NULL DEFAULT 0.1,
    night_start_hour INTEGER NOT NULL DEFAULT 0,
    night_end_hour INTEGER NOT NULL DEFAULT 8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MAP & TILES
-- ============================================================

CREATE TABLE tiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    biome biome_type NOT NULL DEFAULT 'plains',
    has_settlement BOOLEAN NOT NULL DEFAULT false,
    has_resource_bonus BOOLEAN NOT NULL DEFAULT false,
    resource_bonus_type VARCHAR(32),
    resource_bonus_value NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    is_passable BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(world_id, x, y)
);

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES player_profiles(id) ON DELETE SET NULL,
    alliance_id UUID, -- FK added after alliances table
    tile_id UUID NOT NULL UNIQUE REFERENCES tiles(id),
    name VARCHAR(64) NOT NULL,
    type settlement_type NOT NULL DEFAULT 'normal',
    specialization settlement_specialization NOT NULL DEFAULT 'mixed',
    level INTEGER NOT NULL DEFAULT 1,
    -- Population
    population INTEGER NOT NULL DEFAULT 100,
    population_limit INTEGER NOT NULL DEFAULT 500,
    -- Soft stats
    loyalty INTEGER NOT NULL DEFAULT 100 CHECK (loyalty >= 0 AND loyalty <= 100),
    morale INTEGER NOT NULL DEFAULT 100 CHECK (morale >= 0 AND morale <= 100),
    happiness INTEGER NOT NULL DEFAULT 100 CHECK (happiness >= 0 AND happiness <= 100),
    security INTEGER NOT NULL DEFAULT 50 CHECK (security >= 0 AND security <= 100),
    -- Economy
    tax_rate NUMERIC(4,2) NOT NULL DEFAULT 0.1,
    -- Protection
    has_newbie_shield BOOLEAN NOT NULL DEFAULT true,
    shield_expires_at TIMESTAMPTZ,
    -- Status
    is_under_siege BOOLEAN NOT NULL DEFAULT false,
    is_neutral BOOLEAN NOT NULL DEFAULT false,
    capture_in_progress BOOLEAN NOT NULL DEFAULT false,
    -- Bonuses (from buildings/research/events)
    active_bonuses JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settlement_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL UNIQUE REFERENCES settlements(id) ON DELETE CASCADE,
    -- Basic resources
    wood NUMERIC(12,2) NOT NULL DEFAULT 500,
    stone NUMERIC(12,2) NOT NULL DEFAULT 300,
    iron NUMERIC(12,2) NOT NULL DEFAULT 200,
    food NUMERIC(12,2) NOT NULL DEFAULT 400,
    silver NUMERIC(12,2) NOT NULL DEFAULT 100,
    -- Advanced (unlocked later)
    crystals NUMERIC(12,2) NOT NULL DEFAULT 0,
    sulfur NUMERIC(12,2) NOT NULL DEFAULT 0,
    obsidian NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Meta resources
    influence NUMERIC(12,2) NOT NULL DEFAULT 0,
    prestige NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Storage limits
    wood_limit INTEGER NOT NULL DEFAULT 2000,
    stone_limit INTEGER NOT NULL DEFAULT 2000,
    iron_limit INTEGER NOT NULL DEFAULT 1500,
    food_limit INTEGER NOT NULL DEFAULT 2000,
    silver_limit INTEGER NOT NULL DEFAULT 1000,
    -- Production per hour (calculated)
    wood_per_hour NUMERIC(10,2) NOT NULL DEFAULT 60,
    stone_per_hour NUMERIC(10,2) NOT NULL DEFAULT 40,
    iron_per_hour NUMERIC(10,2) NOT NULL DEFAULT 25,
    food_per_hour NUMERIC(10,2) NOT NULL DEFAULT 50,
    silver_per_hour NUMERIC(10,2) NOT NULL DEFAULT 10,
    -- Food consumption (army upkeep)
    food_consumption_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
    last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUILDINGS
-- ============================================================

CREATE TABLE settlement_buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    building_type VARCHAR(64) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    status building_status NOT NULL DEFAULT 'active',
    population_used INTEGER NOT NULL DEFAULT 0,
    -- Damage state
    hp_percent INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(settlement_id, building_type)
);

CREATE TABLE building_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    building_type VARCHAR(64) NOT NULL,
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    status queue_status NOT NULL DEFAULT 'pending',
    position INTEGER NOT NULL DEFAULT 1,
    -- Costs paid upfront
    cost_wood NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_stone NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_iron NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_food NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_silver NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Time
    duration_seconds INTEGER NOT NULL,
    starts_at TIMESTAMPTZ,
    completes_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Boost
    boosted_by_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UNITS
-- ============================================================

CREATE TABLE settlement_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    unit_type VARCHAR(64) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    in_garrison INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(settlement_id, unit_type)
);

CREATE TABLE training_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    unit_type VARCHAR(64) NOT NULL,
    quantity INTEGER NOT NULL,
    status queue_status NOT NULL DEFAULT 'pending',
    position INTEGER NOT NULL DEFAULT 1,
    -- Costs
    cost_wood NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_iron NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_food NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_silver NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Time
    duration_seconds INTEGER NOT NULL,
    starts_at TIMESTAMPTZ,
    completes_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MOVEMENTS & COMBAT
-- ============================================================

CREATE TABLE movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    origin_settlement_id UUID NOT NULL REFERENCES settlements(id),
    target_settlement_id UUID REFERENCES settlements(id),
    target_tile_id UUID REFERENCES tiles(id),
    type movement_type NOT NULL,
    status movement_status NOT NULL DEFAULT 'traveling',
    -- Army composition (snapshot)
    units JSONB NOT NULL DEFAULT '{}',
    -- Resources carried
    resources JSONB NOT NULL DEFAULT '{}',
    -- Timing
    departs_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    arrives_at TIMESTAMPTZ NOT NULL,
    return_arrives_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    -- Result
    combat_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    movement_id UUID NOT NULL REFERENCES movements(id),
    attacker_id UUID NOT NULL REFERENCES player_profiles(id),
    defender_id UUID REFERENCES player_profiles(id),
    settlement_id UUID NOT NULL REFERENCES settlements(id),
    -- Army snapshots
    attacker_units JSONB NOT NULL DEFAULT '{}',
    defender_units JSONB NOT NULL DEFAULT '{}',
    -- Combat factors
    wall_level INTEGER NOT NULL DEFAULT 0,
    morale_attacker INTEGER NOT NULL DEFAULT 100,
    morale_defender INTEGER NOT NULL DEFAULT 100,
    biome biome_type NOT NULL DEFAULT 'plains',
    night_bonus BOOLEAN NOT NULL DEFAULT false,
    -- Results
    attacker_losses JSONB NOT NULL DEFAULT '{}',
    defender_losses JSONB NOT NULL DEFAULT '{}',
    resources_looted JSONB NOT NULL DEFAULT '{}',
    wall_damage INTEGER NOT NULL DEFAULT 0,
    buildings_damaged JSONB NOT NULL DEFAULT '[]',
    loyalty_reduction INTEGER NOT NULL DEFAULT 0,
    attacker_won BOOLEAN,
    capture_attempt BOOLEAN NOT NULL DEFAULT false,
    capture_success BOOLEAN NOT NULL DEFAULT false,
    -- Full log for replay
    battle_log JSONB NOT NULL DEFAULT '[]',
    fought_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scout_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_id UUID NOT NULL REFERENCES movements(id),
    scout_player_id UUID NOT NULL REFERENCES player_profiles(id),
    target_settlement_id UUID NOT NULL REFERENCES settlements(id),
    -- What was discovered (based on scout level)
    resources_seen JSONB,
    units_seen JSONB,
    buildings_seen JSONB,
    loyalty_seen INTEGER,
    traps_detected BOOLEAN NOT NULL DEFAULT false,
    active_buffs_seen JSONB,
    -- Was counter-scouted?
    detected BOOLEAN NOT NULL DEFAULT false,
    scout_success_rate NUMERIC(4,2),
    scouted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RESEARCH
-- ============================================================

CREATE TABLE player_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    research_type VARCHAR(64) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    researching_settlement_id UUID REFERENCES settlements(id),
    research_started_at TIMESTAMPTZ,
    research_completes_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, world_id, research_type)
);

-- ============================================================
-- ALLIANCES
-- ============================================================

CREATE TABLE alliances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    tag VARCHAR(8) NOT NULL,
    description TEXT,
    leader_id UUID NOT NULL REFERENCES player_profiles(id),
    member_count INTEGER NOT NULL DEFAULT 1,
    max_members INTEGER NOT NULL DEFAULT 30,
    power_rating INTEGER NOT NULL DEFAULT 0,
    war_rating INTEGER NOT NULL DEFAULT 0,
    -- Alliance resources (shared bank)
    bank_wood NUMERIC(12,2) NOT NULL DEFAULT 0,
    bank_stone NUMERIC(12,2) NOT NULL DEFAULT 0,
    bank_iron NUMERIC(12,2) NOT NULL DEFAULT 0,
    bank_silver NUMERIC(12,2) NOT NULL DEFAULT 0,
    logo_url VARCHAR(512),
    announcement TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(world_id, tag)
);

CREATE TABLE alliance_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    role alliance_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    contribution_points INTEGER NOT NULL DEFAULT 0,
    UNIQUE(alliance_id, player_id)
);

CREATE TABLE alliance_relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    alliance_a_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    alliance_b_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    type diplomacy_type NOT NULL DEFAULT 'peace',
    initiated_by UUID NOT NULL REFERENCES alliances(id),
    confirmed BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK(alliance_a_id != alliance_b_id),
    UNIQUE(world_id, alliance_a_id, alliance_b_id)
);

-- Add alliance FK to settlements
ALTER TABLE settlements ADD CONSTRAINT fk_alliance
    FOREIGN KEY (alliance_id) REFERENCES alliances(id) ON DELETE SET NULL;

-- ============================================================
-- MARKET
-- ============================================================

CREATE TABLE market_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    origin_settlement_id UUID NOT NULL REFERENCES settlements(id),
    offer_resource VARCHAR(32) NOT NULL,
    offer_amount NUMERIC(10,2) NOT NULL,
    want_resource VARCHAR(32) NOT NULL,
    want_amount NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_fulfilled BOOLEAN NOT NULL DEFAULT false,
    buyer_id UUID REFERENCES player_profiles(id),
    fulfilled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    delivery_hours INTEGER NOT NULL DEFAULT 4,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHAT & MESSAGES
-- ============================================================

CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL, -- global, alliance, private, officer, system
    name VARCHAR(64),
    alliance_id UUID REFERENCES alliances(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES player_profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE private_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    subject VARCHAR(128),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    is_deleted_by_sender BOOLEAN NOT NULL DEFAULT false,
    is_deleted_by_recipient BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    type report_type NOT NULL,
    title VARCHAR(256) NOT NULL,
    summary JSONB NOT NULL DEFAULT '{}',
    full_data JSONB NOT NULL DEFAULT '{}',
    combat_id UUID REFERENCES combats(id),
    scout_report_id UUID REFERENCES scout_reports(id),
    movement_id UUID REFERENCES movements(id),
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(256) NOT NULL,
    body TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE world_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    type event_type NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    effects JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUESTS & ACHIEVEMENTS
-- ============================================================

CREATE TABLE player_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    quest_type VARCHAR(64) NOT NULL,
    progress JSONB NOT NULL DEFAULT '{}',
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_claimed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, world_id, quest_type)
);

CREATE TABLE player_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    achievement_type VARCHAR(64) NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, achievement_type)
);

-- ============================================================
-- RANKINGS
-- ============================================================

CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
    power_score BIGINT NOT NULL DEFAULT 0,
    economy_score BIGINT NOT NULL DEFAULT 0,
    war_score BIGINT NOT NULL DEFAULT 0,
    defense_score BIGINT NOT NULL DEFAULT 0,
    dev_score BIGINT NOT NULL DEFAULT 0,
    settlements_count INTEGER NOT NULL DEFAULT 1,
    captures_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(world_id, player_id)
);

CREATE TABLE alliance_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    alliance_id UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    power_score BIGINT NOT NULL DEFAULT 0,
    war_score BIGINT NOT NULL DEFAULT 0,
    territory_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(world_id, alliance_id)
);

-- ============================================================
-- AUDIT & SECURITY
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_id UUID REFERENCES player_profiles(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suspicious_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(128) NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}',
    is_reviewed BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Profiles
CREATE INDEX idx_profiles_nickname ON player_profiles(nickname);
CREATE INDEX idx_profiles_power_rating ON player_profiles(power_rating DESC);

-- Tiles
CREATE INDEX idx_tiles_world_xy ON tiles(world_id, x, y);
CREATE INDEX idx_tiles_biome ON tiles(world_id, biome);

-- Settlements
CREATE INDEX idx_settlements_world ON settlements(world_id);
CREATE INDEX idx_settlements_owner ON settlements(owner_id);
CREATE INDEX idx_settlements_alliance ON settlements(alliance_id);
CREATE INDEX idx_settlements_type ON settlements(world_id, type);

-- Resources
CREATE INDEX idx_resources_settlement ON settlement_resources(settlement_id);
CREATE INDEX idx_resources_last_tick ON settlement_resources(last_tick_at);

-- Buildings
CREATE INDEX idx_buildings_settlement ON settlement_buildings(settlement_id);
CREATE INDEX idx_building_queues_settlement ON building_queues(settlement_id, status);
CREATE INDEX idx_building_queues_completes ON building_queues(completes_at) WHERE status = 'in_progress';

-- Units
CREATE INDEX idx_units_settlement ON settlement_units(settlement_id);
CREATE INDEX idx_training_queues_settlement ON training_queues(settlement_id, status);
CREATE INDEX idx_training_completes ON training_queues(completes_at) WHERE status = 'in_progress';

-- Movements
CREATE INDEX idx_movements_player ON movements(player_id);
CREATE INDEX idx_movements_origin ON movements(origin_settlement_id);
CREATE INDEX idx_movements_target ON movements(target_settlement_id);
CREATE INDEX idx_movements_arrives ON movements(arrives_at) WHERE status = 'traveling';
CREATE INDEX idx_movements_status ON movements(world_id, status);

-- Reports
CREATE INDEX idx_reports_owner ON reports(owner_id, created_at DESC);
CREATE INDEX idx_reports_unread ON reports(owner_id, is_read) WHERE is_read = false;

-- Notifications
CREATE INDEX idx_notifications_player ON notifications(player_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(player_id, is_read) WHERE is_read = false;

-- Chat
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at DESC);

-- Alliances
CREATE INDEX idx_alliance_members_alliance ON alliance_members(alliance_id);
CREATE INDEX idx_alliance_members_player ON alliance_members(player_id);

-- Rankings
CREATE INDEX idx_rankings_world_power ON rankings(world_id, power_score DESC);

-- Audit
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- ============================================================
-- SEED: Default World
-- ============================================================

INSERT INTO worlds (name, slug, description, is_active, is_registration_open, map_size_x, map_size_y)
VALUES ('Аркадия', 'arcadia', 'Первый мир Dominion Realms. Сезон 1.', true, true, 500, 500);

INSERT INTO world_configs (world_id)
SELECT id FROM worlds WHERE slug = 'arcadia';
