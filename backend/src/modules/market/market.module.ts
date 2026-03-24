import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [ResourcesModule],
  providers: [MarketService],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
