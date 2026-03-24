import { Module } from '@nestjs/common';
import { WorldService } from './world.service';
import { WorldController } from './world.controller';

@Module({
  providers: [WorldService],
  controllers: [WorldController],
  exports: [WorldService],
})
export class WorldModule {}
