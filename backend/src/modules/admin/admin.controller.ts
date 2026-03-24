import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { EventsService } from '../events/events.service';
import { RankingService } from '../ranking/ranking.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly eventsService: EventsService,
    private readonly rankingService: RankingService,
  ) {}

  @Get('stats')
  getStats(@Req() req: any, @Query('worldId') worldId: string) {
    return this.adminService.getWorldStats(worldId);
  }

  @Get('players')
  searchPlayers(@Req() req: any, @Query('q') q: string) {
    return this.adminService.searchPlayers(req.user.profileId, q);
  }

  @Get('audit')
  getAudit(@Req() req: any, @Query('page') page?: string) {
    return this.adminService.getAuditLog(req.user.profileId, parseInt(page || '1'));
  }

  @Post('ban/:playerId')
  banPlayer(@Req() req: any, @Param('playerId') id: string, @Body('reason') reason: string) {
    return this.adminService.banPlayer(req.user.profileId, id, reason);
  }

  @Post('unban/:playerId')
  unbanPlayer(@Req() req: any, @Param('playerId') id: string) {
    return this.adminService.unbanPlayer(req.user.profileId, id);
  }

  @Put('world-speed')
  updateSpeed(@Req() req: any, @Body() body: { worldId: string; resource?: number; build?: number; train?: number; movement?: number }) {
    return this.adminService.updateWorldSpeed(req.user.profileId, body.worldId, body);
  }

  @Post('give-resources')
  giveResources(@Req() req: any, @Body() body: { profileId: string; resources: any }) {
    return this.adminService.giveResources(req.user.profileId, body.profileId, body.resources);
  }

  @Post('trigger-event')
  triggerEvent(@Req() req: any, @Body() body: { worldId: string; eventType: string }) {
    return this.eventsService.startEvent(body.worldId, body.eventType);
  }

  @Post('recalc-ranking')
  recalcRanking(@Query('worldId') worldId: string) {
    return this.rankingService.recalculateWorldRankings(worldId);
  }
}
