import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import * as authService from './services/authService';
import * as chatService from './services/chatService';
import { isAllowedOrigin } from './config/origins';

const cookieValue = (header: string | undefined, name: string) => {
  const match = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

export function initializeChatSocket(httpServer: HttpServer) {
  const presence = new Map<string, number>();
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });
  io.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.handshake.headers.cookie, process.env.SESSION_COOKIE_NAME || 'learnflow_session');
      const session = token ? await authService.getSessionFromToken(token) : null;
      if (!session) return next(new Error('UNAUTHENTICATED'));
      socket.data.userId = session.userId;
      next();
    } catch { next(new Error('UNAUTHENTICATED')); }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    presence.set(userId, (presence.get(userId) ?? 0) + 1);
    socket.join(`user:${userId}`);
    socket.on('disconnect', () => {
      const remaining = (presence.get(userId) ?? 1) - 1;
      if (remaining <= 0) {
        presence.delete(userId);
        for (const room of socket.rooms) {
          if (room.startsWith('conversation:')) {
            io.to(room).emit('presence:update', { userId, online: false });
          }
        }
      } else {
        presence.set(userId, remaining);
      }
    });
    socket.on('conversation:join', async (conversationId: string, ack?: (result: unknown) => void) => {
      try {
        await chatService.authorizeSocketConversation(conversationId, userId);
        socket.join(`conversation:${conversationId}`);
        const participants = await chatService.conversationParticipants(conversationId);
        for (const participantId of [participants.studentId, participants.instructorId]) {
          io.to(`conversation:${conversationId}`).emit('presence:update', {
            userId: participantId,
            online: (presence.get(participantId) ?? 0) > 0,
          });
        }
        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, error: e instanceof Error ? e.message : 'FORBIDDEN' });
      }
    });
    socket.on('message:send', async (payload: { conversationId: string; content: string }, ack?: (result: unknown) => void) => {
      try {
        const organizationId = await chatService.authorizeSocketConversation(payload.conversationId, userId);
        const message = await chatService.send(organizationId, payload.conversationId, userId, payload.content);
        io.to(`conversation:${payload.conversationId}`).emit('message:new', message);
        const participants = await chatService.conversationParticipants(payload.conversationId);
        const recipientId = participants.studentId === userId ? participants.instructorId : participants.studentId;
        const unreadCount = await chatService.unreadCount(organizationId, payload.conversationId, recipientId);
        io.to(`user:${recipientId}`).emit('chat:unread', {
          conversationId: payload.conversationId,
          unreadCount,
        });
        ack?.({ success: true, data: message });
      } catch (e) { ack?.({ success: false, error: e instanceof Error ? e.message : 'SERVER_ERROR' }); }
    });
    socket.on('conversation:read', async (conversationId: string) => {
      try {
        const organizationId = await chatService.authorizeSocketConversation(conversationId, userId);
        await chatService.read(organizationId, conversationId, userId);
        const unreadCount = await chatService.unreadCount(organizationId, conversationId, userId);
        io.to(`user:${userId}`).emit('chat:unread', { conversationId, unreadCount });
        io.to(`conversation:${conversationId}`).emit('conversation:read', { userId });
      } catch { /* REST remains authoritative */ }
    });
  });
  return io;
}
