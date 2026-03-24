import { Module } from '@nestjs/common';
import { ScoutingService } from './scouting.service';
import { ScoutingController } from './scouting.controller';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  providers: [ScoutingService],
  controllers: [ScoutingController],
  exports: [ScoutingService],
})
export class ScoutingModule {}
