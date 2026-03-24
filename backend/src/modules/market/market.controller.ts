import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MarketService } from './market.service';

@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get()
  getOrders(@Query('worldId') worldId: string, @Query('resource') resource?: string, @Query('page') page?: string) {
    return this.marketService.getOrders(worldId, { resource, page: parseInt(page || '1') });
  }

  @Get('my')
  getMyOrders(@Req() req: any) {
    return this.marketService.getMyOrders(req.user.profileId);
  }

  @Post('create')
  createOrder(@Req() req: any, @Body() body: {
    settlementId: string; offerResource: string; offerAmount: number;
    wantResource: string; wantAmount: number;
  }) {
    return this.marketService.createOrder({ profileId: req.user.profileId, ...body });
  }

  @Post(':id/fulfill')
  fulfill(@Req() req: any, @Param('id') id: string, @Body('settlementId') settlementId: string) {
    return this.marketService.fulfillOrder(req.user.profileId, settlementId, id);
  }

  @Delete(':id')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.marketService.cancelOrder(req.user.profileId, id);
  }
}
