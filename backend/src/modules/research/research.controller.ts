import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResearchService } from './research.service';

@Controller('research')
@UseGuards(JwtAuthGuard)
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Get()
  getTree(@Req() req: any, @Query('worldId') worldId: string) {
    return this.researchService.getResearchTree(req.user.profileId, worldId);
  }

  @Post('start')
  start(
    @Req() req: any,
    @Body('worldId') worldId: string,
    @Body('researchType') researchType: string,
    @Body('settlementId') settlementId: string,
  ) {
    return this.researchService.startResearch(req.user.profileId, worldId, researchType, settlementId);
  }

  @Post('check')
  check(@Req() req: any, @Query('worldId') worldId: string) {
    return this.researchService.checkAndCompleteResearch(req.user.profileId, worldId);
  }

  @Get('bonuses')
  getBonuses(@Req() req: any, @Query('worldId') worldId: string) {
    return this.researchService.getPlayerBonuses(req.user.profileId, worldId);
  }
}
