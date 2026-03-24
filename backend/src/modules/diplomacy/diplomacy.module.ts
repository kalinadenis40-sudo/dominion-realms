import { Module } from '@nestjs/common';
import { DiplomacyService } from './diplomacy.service';
import { DiplomacyController } from './diplomacy.controller';

@Module({
  providers: [DiplomacyService],
  controllers: [DiplomacyController],
  exports: [DiplomacyService],
})
export class DiplomacyModule {}
