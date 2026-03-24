import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QuestsService } from './quests.service';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get()
  getMyQuests(@Req() req: any, @Query('worldId') worldId: string) {
    return this.questsService.getMyQuests(req.user.profileId, worldId);
  }

  @Post('claim')
  claimReward(
    @Req() req: any,
    @Body('worldId') worldId: string,
    @Body('questType') questType: string,
  ) {
    return this.questsService.claimReward(req.user.profileId, worldId, questType);
  }
}
