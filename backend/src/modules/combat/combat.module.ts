import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CombatEngine } from './combat.engine';
import { CombatService } from './combat.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'combat' })],
  providers: [CombatEngine, CombatService],
  exports: [CombatEngine, CombatService],
})
export class CombatModule {}
