'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ApiError, deleteJson, getJson, postJson } from '@/lib/api';
import type { ChatConversation, ChatListResponse, ChatMessage, ChatMessagesResponse } from './types';

function apiPath(orgId: string, suffix: string) {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function participant(conversation: ChatConversation, userId: string) {
  const person = conversation.studentId === userId ? conversation.instructor : conversation.student;
  return person?.name || person?.email || (conversation.studentId === userId ? 'Instructor' : 'Student');
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  return new Intl.DateTimeFormat(undefined, sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date);
}

export function ChatPanel({ organizationId, userId, initialConversationId, courseId }: {
  organizationId: string;
  userId: string;
  initialConversationId?: string;
  courseId?: string;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState(initialConversationId || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participantOnline, setParticipantOnline] = useState(false);
  const [deliveredMessageIds, setDeliveredMessageIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef(activeId);
  const activeConversationRef = useRef<ChatConversation | null>(null);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeConversationRef.current = active; }, [active]);

  useEffect(() => {
    if (!activeId || !socketRef.current?.connected) return;
    socketRef.current.emit('conversation:join', activeId);
  }, [activeId]);

  const filtered = useMemo(() => conversations.filter((conversation) => {
    const value = `${conversation.course?.title ?? ''} ${participant(conversation, userId)}`.toLowerCase();
    return value.includes(search.toLowerCase());
  }), [conversations, search, userId]);

  async function loadMessages(conversationId: string) {
    const response = await getJson<ChatMessagesResponse>(
      apiPath(organizationId, `/conversations/${conversationId}/messages?limit=50`),
    );
    setMessages([...response.data.messages].reverse());
    setDeliveredMessageIds(new Set(response.data.messages.map((message) => message.id)));
    await postJson(apiPath(organizationId, `/conversations/${conversationId}/read`), undefined);
    socketRef.current?.emit('conversation:read', conversationId);
    setConversations((current) => current.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
    ));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJson<ChatListResponse>(apiPath(organizationId, '/conversations'))
      .then(async (response) => {
        if (cancelled) return;
        setConversations(response.data);
        let requested = initialConversationId || (courseId
          ? response.data.find((conversation) => conversation.courseId === courseId)?.id
          : undefined);
        if (!requested && courseId) {
          const created = await postJson<{ data: ChatConversation }>(
            apiPath(organizationId, `/courses/${courseId}/conversations`),
            {},
          );
          requested = created.data.id;
          setConversations((current) => [created.data, ...current]);
        }
        const nextId = requested || response.data[0]?.id || '';
        setActiveId(nextId);
        if (nextId) await loadMessages(nextId);
      })
      .catch(() => setError('Unable to load conversations.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, initialConversationId, courseId]);

  useEffect(() => {
    // The REST endpoints remain authoritative, while Socket.IO provides live
    // updates when the deployed API is reachable.
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (activeIdRef.current) {
        socket.emit('conversation:join', activeIdRef.current);
        socket.emit('conversation:read', activeIdRef.current);
      }
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('presence:update', (event: { userId: string; online: boolean }) => {
      const currentConversation = activeConversationRef.current;
      if (!currentConversation) return;
      const otherUserId = currentConversation.studentId === userId
        ? currentConversation.instructorId
        : currentConversation.studentId;
      if (event.userId === otherUserId) setParticipantOnline(event.online);
    });
    socket.on('chat:unread', (event: { conversationId: string; unreadCount: number }) => {
      setConversations((current) => current.map((conversation) =>
        conversation.id === event.conversationId
          ? { ...conversation, unreadCount: event.unreadCount }
          : conversation,
      ));
    });
    socket.on('conversation:blocked', (event: { conversationId: string }) => {
      setConversations((current) => current.map((conversation) =>
        conversation.id === event.conversationId
          ? { ...conversation, blockedAt: new Date().toISOString() }
          : conversation,
      ));
    });
    socket.on('conversation:unblocked', (event: { conversationId: string }) => {
      setConversations((current) => current.map((conversation) =>
        conversation.id === event.conversationId
          ? { ...conversation, blockedAt: null, blockedById: null }
          : conversation,
      ));
    });
    socket.on('conversation:deleted', (event: { conversationId: string }) => {
      setConversations((current) => current.filter((conversation) => conversation.id !== event.conversationId));
      if (activeIdRef.current === event.conversationId) {
        setActiveId('');
        setMessages([]);
      }
    });
    socket.on('message:deleted', (event: { conversationId: string; messageId: string }) => {
      if (event.conversationId !== activeIdRef.current) return;
      setMessages((current) => current.map((message) => message.id === event.messageId
        ? { ...message, content: '[deleted]', deletedAt: new Date().toISOString() }
        : message));
    });
    socket.on('conversation:read', (event: { conversationId: string; messageIds: string[] }) => {
      if (event.conversationId !== activeIdRef.current) return;
      setMessages((current) => current.map((message) => event.messageIds.includes(message.id)
        ? { ...message, readAt: new Date().toISOString() }
        : message));
    });
    socket.on('message:new', (message: ChatMessage) => {
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }
      setConversations((current) => current.map((conversation) => conversation.id === message.conversationId
        ? { ...conversation, updatedAt: message.createdAt, messages: [message] }
        : conversation));
      if (message.conversationId === activeIdRef.current) {
        setDeliveredMessageIds((current) => new Set(current).add(message.id));
        socket.emit('conversation:read', message.conversationId);
      }
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  async function selectConversation(id: string) {
    setActiveId(id);
    setError(null);
    try { await loadMessages(id); } catch { setError('Unable to load messages.'); }
    socketRef.current?.emit('conversation:join', id);
    setParticipantOnline(false);
  }

  async function sendMessage() {
    if (!active || !text.trim() || sending || active.blockedAt) return;
    const content = text.trim();
    setSending(true);
    setError(null);
    try {
      if (connected && socketRef.current) {
        await new Promise<void>((resolve, reject) => {
          socketRef.current?.emit('message:send', { conversationId: active.id, content }, (result: { success: boolean; data?: ChatMessage; error?: string }) => {
            if (!result.success || !result.data) reject(new Error(result.error || 'MESSAGE_FAILED'));
            else { setMessages((current) => current.some((item) => item.id === result.data!.id) ? current : [...current, result.data!]); setDeliveredMessageIds((current) => new Set(current).add(result.data!.id)); resolve(); }
          });
        });
      } else {
        const result = await postJson<{ data: ChatMessage }>(apiPath(organizationId, `/conversations/${active.id}/messages`), { content });
        setMessages((current) => [...current, result.data]);
      }
      setText('');
    } catch (sendError) {
      setError(sendError instanceof ApiError && sendError.code === 'CONVERSATION_BLOCKED' ? 'Chat blocked.' : 'Message could not be sent.');
    } finally { setSending(false); }
  }

  async function deleteMessage(messageId: string) {
    if (!active) return;
    try {
      await deleteJson(apiPath(organizationId, `/conversations/${active.id}/messages/${messageId}`));
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: '[deleted]', deletedAt: new Date().toISOString() } : message));
    } catch { setError('Message could not be deleted.'); }
  }

  async function updateConversation(action: 'block' | 'unblock' | 'delete') {
    if (!active || actionLoading) return;
    if (action !== 'unblock' && !window.confirm(action === 'delete' ? 'Delete this chat for both participants?' : 'Block this chat for both participants?')) return;
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await deleteJson(apiPath(organizationId, `/conversations/${active.id}`));
        setConversations((current) => current.filter((conversation) => conversation.id !== active.id));
        setActiveId('');
        setMessages([]);
      } else {
        await postJson(apiPath(organizationId, `/conversations/${active.id}/${action}`), undefined);
        setConversations((current) => current.map((conversation) => conversation.id === active.id
          ? { ...conversation, blockedAt: action === 'block' ? new Date().toISOString() : null }
          : conversation));
      }
    } catch { setError(`Chat could not be ${action === 'delete' ? 'deleted' : action + 'ed'}.`); }
    finally { setActionLoading(false); }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-r border-neutral-200 md:w-80`}>
        <div className="border-b border-neutral-200 p-4">
          <h1 className="text-xl font-bold text-neutral-900">Chat</h1>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="p-6 text-sm text-neutral-500">Loading conversations...</p>
            : filtered.length === 0 ? <p className="p-6 text-sm text-neutral-500">No conversations yet.</p> : filtered.map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation.id)} className={`w-full border-b border-neutral-100 p-4 text-left hover:bg-primary-50 ${conversation.id === activeId ? 'bg-primary-50' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-semibold text-neutral-900">{participant(conversation, userId)}</p>
                {conversation.messages?.[0] && (
                  <time className="shrink-0 text-xs text-neutral-500" dateTime={conversation.messages[0].createdAt}>
                    {formatConversationTime(conversation.messages[0].createdAt)}
                  </time>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-neutral-500">{conversation.messages?.[0]?.content || 'No messages yet'}</p>
                {(conversation.unreadCount ?? 0) > 0 && (
                  <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {(conversation.unreadCount ?? 0) > 99 ? '99+' : conversation.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
        {loading ? <div className="m-auto text-sm text-neutral-500">Loading chat...</div> : active ? <>
          <header className="flex items-center justify-between border-b border-neutral-200 p-4">
            <div>
              <button type="button" onClick={() => setActiveId('')} className="mr-3 text-sm text-primary-700 md:hidden">← Conversations</button>
              <span className="font-semibold text-neutral-900">{participant(active, userId)}</span>
              <span className={`ml-2 text-xs font-medium ${participantOnline ? 'text-success-600' : 'text-neutral-500'}`}>
                ({participantOnline ? 'Online' : 'Offline'})
              </span>
              <p className="text-xs text-neutral-500">{active.course?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation(active.blockedAt ? 'unblock' : 'block')}
                className="rounded-lg bg-[#5a301e] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#432216] disabled:opacity-50"
              >
                {active.blockedAt ? 'Unblock' : 'Block'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation('delete')}
                className="rounded-lg bg-[#ead8c2] px-3 py-1.5 text-xs font-semibold text-[#5a301e] transition-colors hover:bg-[#dfc5a8] disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
            {messages.map((message) => <div key={message.id} className={`group flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${message.senderId === userId ? 'bg-primary-700 text-white' : 'bg-white text-neutral-800 shadow-sm'}`}><p className={message.deletedAt ? 'italic opacity-70' : undefined}>{message.deletedAt ? 'This message was deleted' : message.content}</p><div className="mt-1 flex items-center justify-between gap-3 text-[10px] opacity-70"><span>{formatTime(message.createdAt)}</span>{message.senderId === userId && !message.deletedAt && <><span className={message.readAt ? 'text-sky-300' : 'text-white'}>{deliveredMessageIds.has(message.id) ? '✓✓' : '✓'}</span><button type="button" onClick={() => void deleteMessage(message.id)}>Delete</button></>}</div></div></div>)}
            {messages.length === 0 && <p className="m-auto text-sm text-neutral-500">Start the conversation.</p>}
          </div>
          {error && <p className="border-t border-neutral-200 px-4 py-2 text-sm text-red-600">{error}</p>}
          {active.blockedAt ? <p className="border-t border-neutral-200 p-4 text-center text-sm font-medium text-red-600">Chat blocked</p> : <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex gap-2 border-t border-neutral-200 p-3"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a message..." className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-500" maxLength={5000} /><button type="submit" disabled={sending || !text.trim()} className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button></form>}
        </> : <div className="m-auto text-center text-neutral-500">Select a conversation</div>}
      </section>
    </div>
  );
}
