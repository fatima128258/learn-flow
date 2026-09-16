import { io, type Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;
let sharedSocketUrl: string | null = null;
let consumerCount = 0;

export function acquireChatSocket(socketUrl: string) {
  if (!sharedSocket || sharedSocketUrl !== socketUrl) {
    sharedSocket?.disconnect();
    sharedSocket = io(socketUrl, {
      withCredentials: true,
      // Start with polling so Render can wake a sleeping service before
      // Socket.IO attempts the WebSocket upgrade.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 15000,
    });
    sharedSocketUrl = socketUrl;
  }
  consumerCount += 1;

  return {
    socket: sharedSocket,
    release() {
      consumerCount = Math.max(consumerCount - 1, 0);
      if (consumerCount === 0) {
        sharedSocket?.disconnect();
        sharedSocket = null;
        sharedSocketUrl = null;
      }
    },
  };
}
