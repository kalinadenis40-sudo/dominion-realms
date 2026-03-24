import { Module } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { RankingController } from './ranking.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  providers: [RankingService],
  controllers: [RankingController],
  exports: [RankingService],
})
export class RankingModule {}
