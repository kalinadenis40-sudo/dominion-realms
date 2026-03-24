import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DiplomacyService } from './diplomacy.service';

@Controller('diplomacy')
@UseGuards(JwtAuthGuard)
export class DiplomacyController {
  constructor(private readonly diplomacyService: DiplomacyService) {}

  @Get('my')
  getMyRelations(@Req() req: any) {
    return this.diplomacyService.getMyRelations(req.user.profileId);
  }

  @Get(':allianceId')
  getRelations(@Param('allianceId') id: string) {
    return this.diplomacyService.getRelations(id);
  }

  @Post('propose')
  propose(@Req() req: any, @Body() body: { targetAllianceId: string; type: any }) {
    return this.diplomacyService.proposeDiplomacy(req.user.profileId, body.targetAllianceId, body.type);
  }

  @Post('confirm/:id')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.diplomacyService.confirmRelation(req.user.profileId, id);
  }
}
