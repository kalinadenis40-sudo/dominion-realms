import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BuildingsService } from './buildings.service';
import { BuildingsController } from './buildings.controller';
import { BuildingQueueJob } from './building-queue.job';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'buildings' }),
    ResourcesModule,
  ],
  providers: [BuildingsService, BuildingQueueJob],
  controllers: [BuildingsController],
  exports: [BuildingsService],
})
export class BuildingsModule {}
