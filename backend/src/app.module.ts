import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { UnitsModule } from './modules/units/units.module';
import { WorldModule } from './modules/world/world.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CombatModule } from './modules/combat/combat.module';
import { MovementsModule } from './modules/movements/movements.module';
import { MapModule } from './modules/map/map.module';
import { ScoutingModule } from './modules/scouting/scouting.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AlliancesModule } from './modules/alliances/alliances.module';
import { DiplomacyModule } from './modules/diplomacy/diplomacy.module';
import { ChatModule } from './modules/chat/chat.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuestsModule } from './modules/quests/quests.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { EventsModule } from './modules/events/events.module';
import { MarketModule } from './modules/market/market.module';
import { SeasonsModule } from './modules/seasons/seasons.module';
import { AdminModule } from './modules/admin/admin.module';
import { ResearchModule } from './modules/research/research.module';
import { gameConfig } from './config/game.config';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [gameConfig],
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Job queues
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    BullModule.registerQueue(
      { name: 'buildings' },
      { name: 'training' },
      { name: 'movements' },
      { name: 'combat' },
      { name: 'resources' },
    ),
    DatabaseModule,
    AuthModule,
    WorldModule,
    SettlementsModule,
    ResourcesModule,
    BuildingsModule,
    UnitsModule,
    DashboardModule,
    MovementsModule,
    CombatModule,
    ScoutingModule,
    MapModule,
    ReportsModule,
    AlliancesModule,
    DiplomacyModule,
    ChatModule,
    RankingModule,
    MessagesModule,
    NotificationsModule,
    QuestsModule,
    AchievementsModule,
    EventsModule,
    MarketModule,
    SeasonsModule,
    AdminModule,
    ResearchModule,
  ],
})
export class AppModule {}
