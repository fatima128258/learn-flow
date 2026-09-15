import { io, type Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;
let sharedSocketUrl: string | null = null;
let consumerCount = 0;

export function acquireChatSocket(socketUrl: string) {
  if (!sharedSocket || sharedSocketUrl !== socketUrl) {
    sharedSocket?.disconnect();
    sharedSocket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
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
