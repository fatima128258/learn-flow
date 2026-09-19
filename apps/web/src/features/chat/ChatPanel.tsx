'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ApiError, deleteJson, getJson, postJson, postJsonWithTimeout } from '@/lib/api';
import { ConfirmModal } from '@/components/ui';
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
  const [participantOnline, setParticipantOnline] = useState(false);
  const [deliveredMessageIds, setDeliveredMessageIds] = useState<Set<string>>(new Set());
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingConversationAction, setPendingConversationAction] = useState<'block' | 'delete' | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const activeConversationRef = useRef<ChatConversation | null>(null);
  const messagesRequestRef = useRef(0);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeConversationRef.current = active; }, [active]);

  useEffect(() => {
    if (messagesLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [activeId, messages, messagesLoading]);

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
      const latestMessage = response.data.messages[0];
      if (latestMessage) {
        setConversations((current) => current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, updatedAt: latestMessage.createdAt, messages: [latestMessage] }
            : conversation,
        ));
      }

      // Read synchronization is independent from history rendering. A slow or
      // unavailable read endpoint must not keep the chat page in its loading state.
      void postJson(apiPath(organizationId, `/conversations/${conversationId}/read`), undefined)
        .then(() => {
          socketRef.current?.emit('conversation:read', conversationId);
          setConversations((current) => current.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
          ));
          window.dispatchEvent(new CustomEvent('learnflow:chat-unread', {
            detail: { conversationId, unreadCount: 0 },
          }));
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
      if (activeIdRef.current) {
        socket.emit('conversation:join', activeIdRef.current);
        socket.emit('conversation:read', activeIdRef.current);
      }
    });
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
      const result = await postJsonWithTimeout<{ data: ChatMessage }>(
        apiPath(organizationId, `/conversations/${active.id}/messages`),
        { content, ...(replyTo ? { replyToId: replyTo.id } : {}) },
        15000,
      );
      setMessages((current) => current.some((item) => item.id === result.data.id) ? current : [...current, result.data]);
      setDeliveredMessageIds((current) => new Set(current).add(result.data.id));
      setConversations((current) => current.map((conversation) =>
        conversation.id === active.id
          ? { ...conversation, updatedAt: result.data.createdAt, messages: [result.data] }
          : conversation,
      ));
      setText('');
      setReplyTo(null);
    } catch (sendError) {
      setError(sendError instanceof ApiError && sendError.code === 'CONVERSATION_BLOCKED' ? 'Chat blocked.' : 'Message could not be sent.');
    } finally { setSending(false); }
  }

  async function deleteMessage(messageId: string) {
    if (!active) return;
    try {
      await deleteJson(apiPath(organizationId, `/conversations/${active.id}/messages/${messageId}`));
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, content: '[deleted]', deletedAt: new Date().toISOString() } : message));
      setReplyTo((current) => current?.id === messageId ? null : current);
      setOpenMessageMenuId(null);
    } catch { setError('Message could not be deleted.'); }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setOpenMessageMenuId(null);
    } catch {
      setError('Message could not be copied.');
    }
  }

  async function updateConversation(action: 'block' | 'unblock' | 'delete') {
    if (!active || actionLoading) return;
    if (action !== 'unblock' && !pendingConversationAction) {
      setPendingConversationAction(action);
      return;
    }
    if (pendingConversationAction === action) setPendingConversationAction(null);
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
    <>
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-[18px] border border-[#ead8c6] bg-[#fffaf5] shadow-sm">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-r border-[#ead8c6] bg-[#fffdf9] md:w-[420px]`}>
        <div className="border-b border-[#ead8c6] bg-[#fffaf5] px-4 py-3">
          <div className="flex rounded-xl border border-[#dfcdbb] bg-[#f5ebdd] p-1">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${tab === 'active' ? 'bg-white text-[#5a321f] shadow-sm' : 'text-[#8b6b55] hover:text-[#7a4a2e]'}`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab('blocked')}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${tab === 'blocked' ? 'bg-white text-[#5a321f] shadow-sm' : 'text-[#8b6b55] hover:text-[#7a4a2e]'}`}
          >
            Blocked
          </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 border-b border-[#ead8c6] pb-3">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-[1.8] text-[#7a4a2e]">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" />
              <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name..." className="w-full border-0 bg-transparent text-[1.05rem] text-[#5a321f] placeholder:text-[#a78d79] focus:outline-none" />
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
          {loading ? <p className="p-6 text-sm text-neutral-500">Loading conversations...</p>
            : filtered.length === 0 ? <p className="p-6 text-sm text-[#8b6b55]">No conversations yet.</p> : filtered.map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation.id)} className={`flex w-full items-center gap-2 rounded-[18px] border px-3 py-2.5 text-left transition-colors ${conversation.id === activeId ? 'border-[#d69a5b] bg-[#f5ebdd] shadow-sm' : 'border-[#ead8c6] bg-[#fffaf5] hover:bg-[#f5ebdd]'}`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d4b596] text-lg font-semibold text-[#fffaf5] shadow-sm">
                {participant(conversation, userId).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 truncate text-[1.05rem] font-normal text-neutral-900">{participant(conversation, userId)}</p>
                    {(conversation.unreadCount ?? 0) > 0 && (
                      <span
                        aria-label={`${conversation.unreadCount} unread message${conversation.unreadCount === 1 ? '' : 's'}`}
                        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#20b957] px-1.5 text-[11px] font-semibold leading-none text-white"
                      >
                        {(conversation.unreadCount ?? 0) > 99 ? '99+' : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  {conversation.messages?.[0] && (
                    <time className="shrink-0 text-[0.95rem] text-neutral-500" dateTime={conversation.messages[0].createdAt}>
                      {formatConversationTime(conversation.messages[0].createdAt)}
                    </time>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[0.95rem] text-neutral-700">{conversation.messages?.[0]?.content || 'No messages yet'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col bg-[#f7f5f3]`}>
        {loading ? <div className="m-auto text-sm text-neutral-500">Loading chat...</div> : active ? <>
          <header className="flex items-center justify-between border-b border-[#e8dfd4] bg-[#f6f3f1] px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button type="button" onClick={() => setActiveId('')} className="mr-1 text-sm text-primary-700 md:hidden">←</button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d4b596] text-sm font-semibold text-[#fdfbf8]">{participant(active, userId).charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <span className="block truncate text-[1.05rem] font-normal leading-tight text-neutral-900">{participant(active, userId)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation(active.blockedAt ? 'unblock' : 'block')}
                className="inline-flex items-center rounded-md border border-[#5a321f] bg-[#5a321f] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#472617] disabled:opacity-50"
              >
                {active.blockedAt ? 'Unblock' : 'Block'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void updateConversation('delete')}
                className="inline-flex items-center rounded-md border border-[#ead8c6] bg-[#fffaf5] px-3 py-1.5 text-xs font-semibold text-[#7a4a2e] transition-colors hover:bg-[#f5ebdd] disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </header>
          <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto bg-[#f7f5f3] p-4">
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
                        <span className="rounded-md bg-[#ebe7e4] px-3 py-1 text-[11px] font-medium text-neutral-600 shadow-sm">
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
                        <div className="group relative">
                          <div className={`rounded-[20px] px-4 py-2 text-[15px] leading-6 shadow-sm ${isOutgoing ? 'rounded-br-md bg-[#f0dfc8] text-[#343434]' : 'rounded-bl-md bg-[#f2f2f2] text-[#3f3f3f]'}`}>
                          {message.replyTo && (
                            <div className="mb-2 border-l-2 border-[#c58c63] bg-black/5 px-2.5 py-1.5 text-xs leading-5 text-neutral-600">
                              <p className="font-semibold text-[#7a4a2a]">
                                {message.replyTo.senderId === userId ? 'You' : participant(active, userId)}
                              </p>
                              <p className="truncate">{message.replyTo.deletedAt ? 'This message was deleted' : message.replyTo.content}</p>
                            </div>
                          )}
                          <p className={`${message.deletedAt ? 'italic opacity-70' : ''} ${!message.deletedAt ? 'pr-5' : ''}`}>{message.deletedAt ? 'This message was deleted' : message.content}</p>
                          <div className={`mt-1 flex items-center gap-1 text-[10px] text-neutral-500 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {isOutgoing && !message.deletedAt && (
                              <span className={`-ml-0.5 text-[11px] font-bold tracking-[-0.08em] ${message.readAt ? 'text-sky-700' : 'text-neutral-700'}`}>
                                {deliveredMessageIds.has(message.id) ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                          {!message.deletedAt && (
                            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                aria-label="Message actions"
                                aria-expanded={openMessageMenuId === message.id}
                                onClick={() => setOpenMessageMenuId((current) => current === message.id ? null : message.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-base font-semibold leading-none text-neutral-500 hover:bg-black/10 hover:text-neutral-800"
                              >
                                ▾
                              </button>
                              {openMessageMenuId === message.id && (
                                <div className="absolute bottom-7 right-0 z-20 w-28 rounded-lg border border-[#e4ddd6] bg-white p-1 text-left text-xs shadow-lg">
                                  <button
                                    type="button"
                                    onClick={() => { setReplyTo(message); setOpenMessageMenuId(null); }}
                                    className="block w-full rounded px-2 py-2 text-left text-neutral-700 hover:bg-[#f5eee8]"
                                  >
                                    Reply
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void copyMessage(message)}
                                    className="block w-full rounded px-2 py-2 text-left text-neutral-700 hover:bg-[#f5eee8]"
                                  >
                                    Copy
                                  </button>
                                  {isOutgoing && (
                                    <button
                                      type="button"
                                      onClick={() => void deleteMessage(message.id)}
                                      className="block w-full rounded px-2 py-2 text-left text-[#a34f3d] hover:bg-[#fff0ed]"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          </div>
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
            <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="border-t border-[#e8dfd4] bg-[#f7f5f3] p-3">
              {replyTo && (
                <div className="mb-2 flex items-start justify-between rounded-lg border-l-2 border-[#c58c63] bg-[#f0e5dc] px-3 py-2 text-xs text-neutral-600">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#7a4a2a]">Replying to {replyTo.senderId === userId ? 'yourself' : participant(active, userId)}</p>
                    <p className="truncate">{replyTo.content}</p>
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} className="ml-3 text-base text-neutral-500 hover:text-neutral-800" aria-label="Cancel reply">×</button>
                </div>
              )}
              <div className="flex items-center gap-3">
              <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a message..." className="min-w-0 flex-1 rounded-full border border-[#d9c8b7] bg-white px-4 py-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-[#c7a58a] focus:outline-none" maxLength={5000} />
              <button type="submit" disabled={sending || !text.trim()} className="flex items-center justify-center rounded-full bg-[#593421] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50">
                {sending ? 'Sending...' : 'Send'}
              </button>
              </div>
            </form>
          )}
        </> : <div className="m-auto text-center text-neutral-500">Select a conversation</div>}
      </section>
    </div>
    <ConfirmModal
      isOpen={Boolean(pendingConversationAction)}
      onClose={() => setPendingConversationAction(null)}
      onConfirm={() => {
        if (pendingConversationAction) void updateConversation(pendingConversationAction);
      }}
      title={pendingConversationAction === 'delete' ? 'Delete chat?' : 'Block user?'}
      message={pendingConversationAction === 'delete'
        ? 'Are you sure you want to delete this chat for both participants?'
        : 'Are you sure you want to block this user?'}
      confirmLabel={pendingConversationAction === 'delete' ? 'Delete' : 'Block'}
      variant="danger"
      loading={actionLoading}
    />
    </>
  );
}
