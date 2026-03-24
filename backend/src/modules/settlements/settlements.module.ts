import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsController } from './settlements.controller';
import { WorldModule } from '../world/world.module';

@Module({
  imports: [WorldModule],
  providers: [SettlementsService],
  controllers: [SettlementsController],
  exports: [SettlementsService],
})
export class SettlementsModule {}
