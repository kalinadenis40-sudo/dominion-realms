import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('inbox')
  getInbox(@Req() req: any, @Query('page') page?: string) {
    return this.messagesService.getInbox(req.user.profileId, parseInt(page || '1'));
  }

  @Get('sent')
  getSent(@Req() req: any) {
    return this.messagesService.getSent(req.user.profileId);
  }

  @Get('unread')
  getUnread(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user.profileId);
  }

  @Get(':id')
  getMessage(@Param('id') id: string, @Req() req: any) {
    return this.messagesService.getMessage(id, req.user.profileId);
  }

  @Post('send')
  sendMessage(
    @Req() req: any,
    @Body() body: { recipientNickname: string; subject: string; content: string },
  ) {
    return this.messagesService.sendMessage(req.user.profileId, body.recipientNickname, body.subject, body.content);
  }
}
