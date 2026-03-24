import { Module } from '@nestjs/common';
import { AlliancesService } from './alliances.service';
import { AlliancesController } from './alliances.controller';

@Module({
  providers: [AlliancesService],
  controllers: [AlliancesController],
  exports: [AlliancesService],
})
export class AlliancesModule {}
