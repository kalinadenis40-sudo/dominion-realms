import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('active')
  getActive(@Query('worldId') worldId: string) {
    return this.eventsService.getActiveEvents(worldId);
  }

  @Get('history')
  getHistory(@Query('worldId') worldId: string) {
    return this.eventsService.getEventHistory(worldId);
  }

  // Admin only in production, open for dev
  @Post('trigger')
  trigger(@Body('worldId') worldId: string, @Body('eventType') eventType: string) {
    return this.eventsService.startEvent(worldId, eventType);
  }
}
