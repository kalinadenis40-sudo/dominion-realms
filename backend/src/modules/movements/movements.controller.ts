import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MovementsService } from './movements.service';

@Controller('movements')
@UseGuards(JwtAuthGuard)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  getMyMovements(@Req() req: any) {
    return this.movementsService.getMyMovements(req.user.profileId);
  }

  @Post('send')
  sendMovement(@Req() req: any, @Body() body: {
    originSettlementId: string;
    targetSettlementId: string;
    type: any;
    units: Record<string, number>;
    resources?: Record<string, number>;
  }) {
    return this.movementsService.sendMovement({
      profileId: req.user.profileId,
      ...body,
    });
  }

  @Delete(':id/recall')
  recallMovement(@Param('id') id: string, @Req() req: any) {
    return this.movementsService.recallMovement(id, req.user.profileId);
  }
}
