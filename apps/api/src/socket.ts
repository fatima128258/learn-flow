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
    socket.on('conversation:join', async (conversationId: string, ack?: (result: unknown) => void) => {
      try { await chatService.messages(undefined, conversationId, socket.data.userId, 1); socket.join(`conversation:${conversationId}`); ack?.({ success: true }); }
      catch { ack?.({ success: false, error: 'FORBIDDEN' }); }
    });
    socket.on('message:send', async (payload: { conversationId: string; content: string }, ack?: (result: unknown) => void) => {
      try {
        const conversation = await chatService.messages(undefined, payload.conversationId, socket.data.userId, 1).catch(() => null);
        if (!conversation) throw new Error('FORBIDDEN');
        const message = await chatService.send(undefined, payload.conversationId, socket.data.userId, payload.content);
        io.to(`conversation:${payload.conversationId}`).emit('message:new', message);
        ack?.({ success: true, data: message });
      } catch (e) { ack?.({ success: false, error: e instanceof Error ? e.message : 'SERVER_ERROR' }); }
    });
    socket.on('conversation:read', async (conversationId: string) => {
      try { await chatService.read(undefined, conversationId, socket.data.userId); io.to(`conversation:${conversationId}`).emit('conversation:read', { userId: socket.data.userId }); } catch { /* REST remains authoritative */ }
    });
  });
  return io;
}
