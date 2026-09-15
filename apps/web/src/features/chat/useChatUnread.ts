'use client';

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getJson } from '@/lib/api';
import type { ChatListResponse } from './types';

export function useChatUnread(organizationId?: string, userId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || 'https://learn-flow-1-1gl3.onrender.com';

  useEffect(() => {
    if (!organizationId || !userId) return;
    let cancelled = false;
    getJson<ChatListResponse>(`/api/v1/organizations/${organizationId}/conversations`)
      .then((response) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(response.data.map((conversation) => [
          conversation.id,
          conversation.unreadCount ?? 0,
        ])));
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });

    const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('chat:unread', (event: { conversationId: string; unreadCount: number }) => {
      setCounts((current) => ({ ...current, [event.conversationId]: event.unreadCount }));
    });
    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [organizationId, socketUrl, userId]);

  return useMemo(
    () => Object.values(counts).reduce((total, count) => total + count, 0),
    [counts],
  );
}
