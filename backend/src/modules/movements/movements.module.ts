import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';
import { MovementsJob } from './movements.job';
import { CombatModule } from '../combat/combat.module';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'movements' }),
    CombatModule,
    ResourcesModule,
  ],
  providers: [MovementsService, MovementsJob],
  controllers: [MovementsController],
  exports: [MovementsService],
})
export class MovementsModule {}
