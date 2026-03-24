import { Controller, Get, Query, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MapService } from './map.service';

@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('viewport')
  getViewport(
    @Query('worldId') worldId: string,
    @Query('x1') x1: string, @Query('y1') y1: string,
    @Query('x2') x2: string, @Query('y2') y2: string,
    @Req() req: any,
  ) {
    return this.mapService.getMapViewport(
      worldId,
      parseInt(x1 || '0'), parseInt(y1 || '0'),
      parseInt(x2 || '100'), parseInt(y2 || '100'),
      req.user.profileId,
    );
  }

  @Get('settlement/:id')
  getCard(@Param('id') id: string, @Req() req: any) {
    return this.mapService.getSettlementCard(id, req.user.profileId);
  }

  @Get('search')
  search(@Query('worldId') worldId: string, @Query('q') q: string) {
    return this.mapService.searchByPlayer(worldId, q);
  }

  @Get('coords')
  searchCoords(
    @Query('worldId') worldId: string,
    @Query('x') x: string, @Query('y') y: string,
  ) {
    return this.mapService.searchByCoords(worldId, parseInt(x), parseInt(y));
  }
}
