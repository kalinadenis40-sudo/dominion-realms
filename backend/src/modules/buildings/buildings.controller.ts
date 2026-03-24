import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BuildingsService } from './buildings.service';

@Controller('settlements/:id/buildings')
@UseGuards(JwtAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  getBuildings(@Param('id') id: string) {
    return this.buildingsService.getBuildings(id);
  }

  @Get(':type/cost')
  getCost(@Param('id') id: string, @Param('type') type: string, @Body('currentLevel') lvl: number) {
    return this.buildingsService.getBuildingCost(type, lvl || 0);
  }

  @Post('upgrade')
  upgrade(@Param('id') id: string, @Body('buildingType') buildingType: string) {
    return this.buildingsService.startUpgrade(id, buildingType);
  }

  @Delete('queue/:queueId')
  cancelUpgrade(@Param('id') id: string, @Param('queueId') queueId: string) {
    return this.buildingsService.cancelUpgrade(queueId, id);
  }
}
