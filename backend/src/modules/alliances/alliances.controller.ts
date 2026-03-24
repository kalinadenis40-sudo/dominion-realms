import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AlliancesService } from './alliances.service';

@Controller('alliances')
@UseGuards(JwtAuthGuard)
export class AlliancesController {
  constructor(private readonly alliancesService: AlliancesService) {}

  @Get('my')
  getMyAlliance(@Req() req: any) {
    return this.alliancesService.getMyAlliance(req.user.profileId);
  }

  @Get('search')
  search(@Query('worldId') worldId: string, @Query('q') q?: string) {
    return this.alliancesService.searchAlliances(worldId, q);
  }

  @Get(':id')
  getAlliance(@Param('id') id: string) {
    return this.alliancesService.getAllianceById(id);
  }

  @Post('create')
  createAlliance(@Req() req: any, @Body() body: { name: string; tag: string; description?: string }) {
    return this.alliancesService.createAlliance(req.user.profileId, body.name, body.tag, body.description);
  }

  @Post('join/:id')
  joinAlliance(@Req() req: any, @Param('id') id: string) {
    return this.alliancesService.joinAlliance(req.user.profileId, id);
  }

  @Post('leave')
  leaveAlliance(@Req() req: any) {
    return this.alliancesService.leaveAlliance(req.user.profileId);
  }

  @Post('kick/:playerId')
  kickMember(@Req() req: any, @Param('playerId') playerId: string) {
    return this.alliancesService.kickMember(req.user.profileId, playerId);
  }

  @Put('role/:playerId')
  setRole(@Req() req: any, @Param('playerId') playerId: string, @Body('role') role: string) {
    return this.alliancesService.setMemberRole(req.user.profileId, playerId, role);
  }

  @Put('announcement')
  updateAnnouncement(@Req() req: any, @Body('announcement') announcement: string) {
    return this.alliancesService.updateAnnouncement(req.user.profileId, announcement);
  }
}
