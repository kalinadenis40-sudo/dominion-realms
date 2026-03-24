import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UnitsService } from './units.service';
import { UnitsController } from './units.controller';
import { TrainingQueueJob } from './training-queue.job';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'training' }), ResourcesModule],
  providers: [UnitsService, TrainingQueueJob],
  controllers: [UnitsController],
  exports: [UnitsService],
})
export class UnitsModule {}
