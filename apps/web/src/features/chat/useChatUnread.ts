'use client';

import { useEffect, useMemo, useState } from 'react';
import { getJson } from '@/lib/api';
import type { ChatListResponse } from './types';
import { acquireChatSocket } from './chatSocket';

export function useChatUnread(organizationId?: string, userId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    || process.env.NEXT_PUBLIC_BACKEND_URL
    || 'https://learn-flow-1-1gl3.onrender.com';

  useEffect(() => {
    if (!organizationId || !userId) return;
    let cancelled = false;
    let socketEventVersion = 0;
    const requestVersion = socketEventVersion;
    const applyServerCounts = (response: ChatListResponse) => {
      if (cancelled || requestVersion !== socketEventVersion) return;
      setCounts(Object.fromEntries(response.data.map((conversation) => [
        conversation.id,
        conversation.unreadCount ?? 0,
      ])));
    };

    const { socket, release } = acquireChatSocket(socketUrl);
    socket.on('chat:unread', (event: { conversationId: string; unreadCount: number }) => {
      socketEventVersion += 1;
      setCounts((current) => ({ ...current, [event.conversationId]: event.unreadCount }));
    });

    getJson<ChatListResponse>(`/api/v1/organizations/${organizationId}/conversations`)
      .then((response) => {
        applyServerCounts(response);
      })
      .catch(() => {
        // Preserve any server-backed socket state already received.
      });

    return () => {
      cancelled = true;
      release();
    };
  }, [organizationId, socketUrl, userId]);

  return useMemo(
    () => Object.values(counts).reduce((total, count) => total + count, 0),
    [counts],
  );
}
