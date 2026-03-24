import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SeasonsService } from './seasons.service';

@Controller('seasons')
@UseGuards(JwtAuthGuard)
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get('current')
  getCurrent(@Query('worldId') worldId: string) {
    return this.seasonsService.getCurrentSeason(worldId);
  }

  @Get('my-history')
  getMyHistory(@Req() req: any) {
    return this.seasonsService.getSeasonHistory(req.user.profileId);
  }
}
