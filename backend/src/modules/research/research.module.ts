import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [ResourcesModule],
  providers: [ResearchService],
  controllers: [ResearchController],
  exports: [ResearchService],
})
export class ResearchModule {}
