'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ApiError, deleteJson, getJson, postJson } from '@/lib/api';
import type { ChatConversation, ChatListResponse, ChatMessage, ChatMessagesResponse } from './types';
import { acquireChatSocket } from './chatSocket';

function apiPath(orgId: string, suffix: string) {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function participant(conversation: ChatConversation, userId: string) {
  const person = conversation.studentId === userId ? conversation.instructor : conversation.student;
  return person?.name || person?.email || (conversation.studentId === userId ? 'Instructor' : 'Student');
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function isSameCalendarDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function formatDateSeparator(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) return 'Today';
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
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
  const [tab, setTab] = useState<'active' | 'blocked'>('active');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [participantOnline, setParticipantOnline] = useState(false);
  const [deliveredMessageIds, setDeliveredMessageIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef(activeId);
  const activeConversationRef = useRef<ChatConversation | null>(null);
  const messagesRequestRef = useRef(0);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeConversationRef.current = active; }, [active]);

  useEffect(() => {
    if (!activeId || !socketRef.current?.connected) return;
    socketRef.current.emit('conversation:join', activeId);
  }, [activeId]);

  const filtered = useMemo(() => {
    const base = conversations.filter((conversation) => {
      const matchesTab = tab === 'blocked' ? Boolean(conversation.blockedAt) : !conversation.blockedAt;
      if (!matchesTab) return false;
      const value = `${conversation.course?.title ?? ''} ${participant(conversation, userId)}`.toLowerCase();
      return value.includes(search.toLowerCase());
    });

    return base.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, search, tab, userId]);

  async function loadMessages(conversationId: string) {
    const requestId = messagesRequestRef.current + 1;
    messagesRequestRef.current = requestId;
    setMessagesLoading(true);
    try {
      const response = await getJson<ChatMessagesResponse>(
        apiPath(organizationId, `/conversations/${conversationId}/messages?limit=50`),
      );
      if (requestId !== messagesRequestRef.current) return;
      setMessages([...response.data.messages].reverse());
      setDeliveredMessageIds(new Set(response.data.messages.map((message) => message.id)));

      // Read synchronization is independent from history rendering. A slow or
      // unavailable read endpoint must not keep the chat page in its loading state.
      void postJson(apiPath(organizationId, `/conversations/${conversationId}/read`), undefined)
        .then(() => {
          socketRef.current?.emit('conversation:read', conversationId);
          setConversations((current) => current.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ));
        })
        .catch(() => setError('Messages loaded, but could not be marked as read.'));
    } finally {
      if (requestId === messagesRequestRef.current) setMessagesLoading(false);
    }
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
        setLoading(false);
        if (nextId) void loadMessages(nextId).catch(() => setError('Unable to load messages.'));
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load conversations.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [organizationId, initialConversationId, courseId]);

  useEffect(() => {
    // The REST endpoints remain authoritative, while Socket.IO provides live
    // updates when the deployed API is reachable.
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || 'https://learn-flow-1-1gl3.onrender.com';
    const { socket, release } = acquireChatSocket(socketUrl);
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
    return () => { release(); socketRef.current = null; };
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
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-[18px] border border-[#dfe2df] bg-[#f5f2ee] shadow-sm">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-r border-[#dfe2df] bg-[#f5f3f2] md:w-[420px]`}>
        <div className="flex border-b border-[#dfe2df] bg-[#f7f4f2]">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`flex-1 py-5 text-center text-[1.9rem] font-light tracking-[-0.04em] transition-colors ${tab === 'active' ? 'border-b-[3px] border-[#2e7a74] text-[#2e7a74]' : 'text-[#6c726f]'}`}
          >
            Active Contacts
          </button>
          <button
            type="button"
            onClick={() => setTab('blocked')}
            className={`flex-1 py-5 text-center text-[1.9rem] font-light tracking-[-0.04em] transition-colors ${tab === 'blocked' ? 'border-b-[3px] border-[#2e7a74] text-[#2e7a74]' : 'text-[#6c726f]'}`}
          >
            Blocked Contacts
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 border-b border-[#dfe2df] pb-3">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-[1.8] text-[#5b5e5d]">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" />
              <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name..." className="w-full border-0 bg-transparent text-[1.05rem] text-neutral-700 placeholder:text-[#8c8f8c] focus:outline-none" />
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
          {loading ? <p className="p-6 text-sm text-neutral-500">Loading conversations...</p>
            : filtered.length === 0 ? <p className="p-6 text-sm text-neutral-500">No conversations yet.</p> : filtered.map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation.id)} className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-4 text-left transition-colors ${conversation.id === activeId ? 'border-[#d5d0ca] bg-[#f0e9e3] shadow-sm' : 'border-[#dfe2df] bg-[#f6f8f7] hover:bg-[#f2efe9]'}`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#cfcfcf] text-lg font-semibold text-[#fafafa] shadow-sm">
                {participant(conversation, userId).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[1.05rem] font-semibold text-neutral-900">{participant(conversation, userId)}</p>
                  {conversation.messages?.[0] && (
                    <time className="shrink-0 text-[0.95rem] text-neutral-500" dateTime={conversation.messages[0].createdAt}>
                      {formatConversationTime(conversation.messages[0].createdAt)}
                    </time>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${tab === 'active' ? 'bg-[#2e7a74]' : 'bg-neutral-400'}`} />
                  <p className="min-w-0 flex-1 truncate text-[1rem] text-neutral-700">{conversation.messages?.[0]?.content || 'No messages yet'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col bg-[#f7f5f3]`}>
        {loading ? <div className="m-auto text-sm text-neutral-500">Loading chat...</div> : active ? <>
          <header className="flex items-center justify-between border-b border-[#e8dfd4] bg-[#f6f3f1] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setActiveId('')} className="mr-1 text-sm text-primary-700 md:hidden">←</button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4b596] text-sm font-semibold text-[#fdfbf8]">{participant(active, userId).charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[1.05rem] font-bold text-neutral-900">{participant(active, userId)}</span>
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${participantOnline ? 'bg-green-500' : 'bg-neutral-400'}`} />
                  <span className="text-xs font-medium text-neutral-500">{participantOnline ? 'Online' : 'Offline'}</span>
                </div>
                <p className="truncate text-xs text-neutral-500">{active.course?.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation(active.blockedAt ? 'unblock' : 'block')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d6b6a1] bg-[#f4e9e1] px-3 py-2 text-xs font-semibold text-[#6b3e2d] transition-colors hover:bg-[#ead8c8] disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
                </svg>
                {active.blockedAt ? 'Unblock' : 'Block'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation('delete')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d6b6a1] bg-[#f4e9e1] px-3 py-2 text-xs font-semibold text-[#6b3e2d] transition-colors hover:bg-[#ead8c8] disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                  <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete
              </button>
            </div>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f5f3] p-4">
            {messagesLoading ? <p className="m-auto text-sm text-neutral-500">Loading messages...</p>
              : messages.map((message, index) => {
                const previousMessage = messages[index - 1];
                const showDateSeparator = !previousMessage
                  || !isSameCalendarDay(new Date(previousMessage.createdAt), new Date(message.createdAt));
                const isOutgoing = message.senderId === userId;
                return (
                  <div key={message.id} className="flex flex-col">
                    {showDateSeparator && (
                      <div className="my-2 flex justify-center">
                        <span className="rounded-full bg-[#ebe7e4] px-3 py-1 text-[11px] font-medium text-neutral-600 shadow-sm">
                          {formatDateSeparator(message.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                      {!isOutgoing && (
                        <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4b596] text-[11px] font-semibold text-white">
                          {participant(active, userId).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`max-w-[68%] ${isOutgoing ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={`rounded-[20px] px-4 py-2 text-[15px] leading-6 shadow-sm ${isOutgoing ? 'rounded-br-md bg-[#f0dfc8] text-neutral-900' : 'rounded-bl-md bg-[#f2f2f2] text-neutral-900'}`}>
                          <p className={message.deletedAt ? 'italic opacity-70' : undefined}>{message.deletedAt ? 'This message was deleted' : message.content}</p>
                        </div>
                        <div className={`mt-1 flex items-center gap-2 text-[10px] ${isOutgoing ? 'justify-end text-neutral-500' : 'justify-start text-neutral-500'}`}>
                          <span>{formatMessageTime(message.createdAt)}</span>
                          {isOutgoing && !message.deletedAt && (
                            <>
                              <span className={message.readAt ? 'text-sky-600' : 'text-neutral-500'}>{deliveredMessageIds.has(message.id) ? '✓✓' : '✓'}</span>
                              <button
                                type="button"
                                onClick={() => void deleteMessage(message.id)}
                                className="rounded p-1 transition-colors hover:bg-black/5"
                                aria-label="Delete message"
                                title="Delete message"
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            {!messagesLoading && messages.length === 0 && <p className="m-auto text-sm text-neutral-500">Start the conversation.</p>}
          </div>
          {error && <p className="border-t border-[#e8dfd4] bg-[#f7f5f3] px-4 py-2 text-sm text-red-600">{error}</p>}
          {active.blockedAt ? <p className="border-t border-[#e8dfd4] bg-[#f7f5f3] p-4 text-center text-sm font-medium text-red-600">Chat blocked</p> : (
            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex items-center gap-3 border-t border-[#e8dfd4] bg-[#f7f5f3] p-3">
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9c8b7] bg-[#f3e7dd] text-xl font-light text-[#5d3526]">+</button>
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a message..." className="min-w-0 flex-1 rounded-full border border-[#d9c8b7] bg-white px-4 py-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-[#c7a58a] focus:outline-none" maxLength={5000} />
              <button type="submit" disabled={sending || !text.trim()} className="flex items-center justify-center rounded-full bg-[#593421] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                <span className="ml-2">Send</span>
              </button>
            </form>
          )}
        </> : <div className="m-auto text-center text-neutral-500">Select a conversation</div>}
      </section>
    </div>
  );
}
