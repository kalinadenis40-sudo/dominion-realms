import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UnitsService } from './units.service';

@Controller('settlements/:id/units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  getUnits(@Param('id') id: string) {
    return this.unitsService.getUnits(id);
  }

  @Get('info')
  getAllInfo() {
    return this.unitsService.getAllUnitsInfo();
  }

  @Post('train')
  train(
    @Param('id') id: string,
    @Body('unitType') unitType: string,
    @Body('quantity') quantity: number,
  ) {
    return this.unitsService.trainUnits(id, unitType, quantity);
  }
}
