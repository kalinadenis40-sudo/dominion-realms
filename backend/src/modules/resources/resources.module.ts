import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ResourceTickJob } from './resource-tick.job';

@Module({
  imports: [BullModule.registerQueue({ name: 'resources' })],
  providers: [ResourcesService, ResourceTickJob],
  controllers: [ResourcesController],
  exports: [ResourcesService],
})
export class ResourcesModule {}
