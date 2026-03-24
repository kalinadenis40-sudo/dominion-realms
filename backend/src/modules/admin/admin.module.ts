import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { EventsModule } from '../events/events.module';
import { RankingModule } from '../ranking/ranking.module';

@Module({
  imports: [EventsModule, RankingModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
