import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScoutingService } from './scouting.service';

@Controller('scouting')
@UseGuards(JwtAuthGuard)
export class ScoutingController {
  constructor(private readonly scoutingService: ScoutingService) {}

  @Post('send')
  sendScouts(@Req() req: any, @Body() body: {
    originSettlementId: string;
    targetSettlementId: string;
    scoutCount: number;
  }) {
    return this.scoutingService.sendScouts(
      req.user.profileId, body.originSettlementId,
      body.targetSettlementId, body.scoutCount,
    );
  }

  @Get('reports')
  getReports(@Req() req: any) {
    return this.scoutingService.getScoutReports(req.user.profileId);
  }
}
