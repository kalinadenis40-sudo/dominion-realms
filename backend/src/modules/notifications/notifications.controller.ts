import { Controller, Get, Post, Delete, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getAll(@Req() req: any, @Query('page') page?: string) {
    return this.notificationsService.getNotifications(req.user.profileId, parseInt(page || '1'));
  }

  @Get('unread')
  getUnread(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.profileId);
  }

  @Post('read-all')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.profileId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markRead(id, req.user.profileId);
  }

  @Delete('clear')
  deleteAll(@Req() req: any) {
    return this.notificationsService.deleteAll(req.user.profileId);
  }
}
