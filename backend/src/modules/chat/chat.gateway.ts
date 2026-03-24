import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('ChatGateway');
  private readonly connected = new Map<string, string>(); // socketId -> profileId

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      this.connected.set(client.id, payload.profileId);
      this.logger.log(`Client connected: ${payload.profileId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connected.delete(client.id);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.join(roomId);
    return { event: 'joined', roomId };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.leave(roomId);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    const profileId = this.connected.get(client.id);
    if (!profileId) return;

    try {
      const message = await this.chatService.sendMessage(data.roomId, profileId, data.content);
      // Broadcast to everyone in the room
      this.server.to(data.roomId).emit('new-message', message);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  // Called from other services to push notifications
  broadcastToPlayer(profileId: string, event: string, data: any) {
    // Find socket for this profile
    for (const [socketId, pid] of this.connected) {
      if (pid === profileId) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
