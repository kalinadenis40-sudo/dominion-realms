import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  getMyRooms(@Req() req: any) {
    return this.chatService.getMyRooms(req.user.profileId);
  }

  @Get('rooms/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(id, req.user.profileId, parseInt(limit || '50'), before);
  }

  @Post('rooms/:id/send')
  sendMessage(
    @Param('id') id: string,
    @Req() req: any,
    @Body('content') content: string,
  ) {
    return this.chatService.sendMessage(id, req.user.profileId, content);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @Req() req: any) {
    return this.chatService.deleteMessage(id, req.user.profileId);
  }
}
