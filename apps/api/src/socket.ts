import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import * as authService from './services/authService';
import * as chatService from './services/chatService';
import { isAllowedOrigin } from './config/origins';
import { chatEvents, type ConversationChange, type MessageChange } from './chatEvents';

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
        // A successful persistence result is the send acknowledgement. Do not
        // make the sender wait for optional unread-notification work.
        ack?.({ success: true, data: message });
        void chatService.conversationParticipants(payload.conversationId)
          .then((participants) => {
            const recipientId = participants.studentId === userId ? participants.instructorId : participants.studentId;
            return chatService.unreadCount(organizationId, payload.conversationId, recipientId)
              .then((unreadCount) => {
                io.to(`user:${recipientId}`).emit('chat:unread', {
                  conversationId: payload.conversationId,
                  unreadCount,
                });
              });
          })
          .catch(() => {
            // The persisted message and delivery acknowledgement are independent
            // from the optional unread-badge update.
          });
      } catch (e) { ack?.({ success: false, error: e instanceof Error ? e.message : 'SERVER_ERROR' }); }
    });
    socket.on('conversation:read', async (conversationId: string) => {
      try {
        const organizationId = await chatService.authorizeSocketConversation(conversationId, userId);
        const messageIds = await chatService.read(organizationId, conversationId, userId);
        const unreadCount = await chatService.unreadCount(organizationId, conversationId, userId);
        io.to(`user:${userId}`).emit('chat:unread', { conversationId, unreadCount });
        io.to(`conversation:${conversationId}`).emit('conversation:read', {
          conversationId,
          userId,
          messageIds,
        });
      } catch { /* REST remains authoritative */ }
    });
  });
  chatEvents.on('conversation:change', async (change: ConversationChange) => {
    io.to(`conversation:${change.conversationId}`).emit(`conversation:${change.type}`, {
      conversationId: change.conversationId,
    });
    const recipientIds = [change.studentId, change.instructorId];
    for (const userId of recipientIds) {
      io.to(`user:${userId}`).emit(`conversation:${change.type}`, {
        conversationId: change.conversationId,
      });
      const unreadCount = change.type === 'deleted'
        ? 0
        : await chatService.unreadCount(change.organizationId, change.conversationId, userId);
      io.to(`user:${userId}`).emit('chat:unread', { conversationId: change.conversationId, unreadCount });
    }
  });
  chatEvents.on('messages:change', (change: MessageChange) => {
    if (change.type === 'created') {
      io.to(`conversation:${change.conversationId}`).emit('message:new', change.message);
      return;
    }
    if (change.type === 'deleted') {
      io.to(`conversation:${change.conversationId}`).emit('message:deleted', {
        conversationId: change.conversationId,
        messageId: change.messageId,
      });
      return;
    }
    io.to(`conversation:${change.conversationId}`).emit('conversation:read', {
      conversationId: change.conversationId,
      userId: change.readerId,
      messageIds: change.messageIds,
    });
    void chatService.unreadCount(change.organizationId, change.conversationId, change.readerId)
      .then((unreadCount) => {
        io.to(`user:${change.readerId}`).emit('chat:unread', {
          conversationId: change.conversationId,
          unreadCount,
        });
      })
      .catch(() => {
        // The read transaction remains authoritative if badge delivery is delayed.
      });
  });
  return io;
}
