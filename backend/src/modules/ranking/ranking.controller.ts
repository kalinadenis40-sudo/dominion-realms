import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RankingService } from './ranking.service';

@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('players')
  getPlayers(
    @Query('worldId') worldId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
  ) {
    return this.rankingService.getPlayerRanking(worldId, type, parseInt(page || '1'));
  }

  @Get('alliances')
  getAlliances(@Query('worldId') worldId: string, @Query('page') page?: string) {
    return this.rankingService.getAllianceRanking(worldId, parseInt(page || '1'));
  }

  @Get('me')
  getMyPosition(@Req() req: any, @Query('worldId') worldId: string) {
    return this.rankingService.getMyPosition(req.user.profileId, worldId);
  }

  @Post('recalc')
  recalc(@Query('worldId') worldId: string) {
    return this.rankingService.recalculateWorldRankings(worldId);
  }
}
