import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SettlementsService } from './settlements.service';

@Controller('settlements')
@UseGuards(JwtAuthGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  getMySettlements(@Req() req: any) {
    return this.settlementsService.getMySettlements(req.user.profileId);
  }

  @Get(':id')
  getSettlement(@Param('id') id: string, @Req() req: any) {
    return this.settlementsService.getSettlementById(id, req.user.profileId);
  }

  @Get(':id/full')
  getSettlementFull(@Param('id') id: string) {
    return this.settlementsService.getSettlementWithBuildings(id);
  }

  // Called during onboarding / world join
  @Post('start')
  async createStarting(@Req() req: any) {
    // nickname comes from profile
    const profileResult = await import('../../database/database.module');
    return this.settlementsService.createStartingSettlement(
      req.user.profileId,
      req.user.nickname || 'Lord',
    );
  }
}
