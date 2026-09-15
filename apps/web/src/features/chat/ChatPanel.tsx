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
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeIdRef = useRef(activeId);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const filtered = useMemo(() => conversations.filter((conversation) => {
    const value = `${conversation.course?.title ?? ''} ${participant(conversation, userId)}`.toLowerCase();
    return value.includes(search.toLowerCase());
  }), [conversations, search, userId]);

  async function loadMessages(conversationId: string) {
    const response = await getJson<ChatMessagesResponse>(
      apiPath(organizationId, `/conversations/${conversationId}/messages?limit=50`),
    );
    setMessages([...response.data.messages].reverse());
    await postJson(apiPath(organizationId, `/conversations/${conversationId}/read`), undefined);
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
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!socketUrl) {
      setError('Chat server is not configured.');
      return;
    }
    const socket = io(socketUrl, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (activeIdRef.current) socket.emit('conversation:join', activeIdRef.current);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('message:new', (message: ChatMessage) => {
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }
      setConversations((current) => current.map((conversation) => conversation.id === message.conversationId
        ? { ...conversation, updatedAt: message.createdAt, messages: [message] }
        : conversation));
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  async function selectConversation(id: string) {
    setActiveId(id);
    setError(null);
    try { await loadMessages(id); } catch { setError('Unable to load messages.'); }
    socketRef.current?.emit('conversation:join', id);
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
            else { setMessages((current) => current.some((item) => item.id === result.data!.id) ? current : [...current, result.data!]); resolve(); }
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

  if (loading) return <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-600">Loading chat...</div>;

  return (
    <div className="flex min-h-[620px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-neutral-200 md:w-80`}>
        <div className="border-b border-neutral-200 p-4">
          <h1 className="text-xl font-bold text-neutral-900">Chat</h1>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? <p className="p-6 text-sm text-neutral-500">No conversations yet.</p> : filtered.map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation.id)} className={`w-full border-b border-neutral-100 p-4 text-left hover:bg-primary-50 ${conversation.id === activeId ? 'bg-primary-50' : ''}`}>
              <p className="font-semibold text-neutral-900">{conversation.course?.title || 'Course'}</p>
              <p className="text-sm text-neutral-600">{participant(conversation, userId)}</p>
              <p className="mt-1 truncate text-xs text-neutral-500">{conversation.messages?.[0]?.content || 'No messages yet'}</p>
            </button>
          ))}
        </div>
      </aside>
      <section className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {active ? <>
          <header className="flex items-center justify-between border-b border-neutral-200 p-4">
            <div><button type="button" onClick={() => setActiveId('')} className="mr-3 text-sm text-primary-700 md:hidden">← Conversations</button><span className="font-semibold text-neutral-900">{participant(active, userId)}</span><p className="text-xs text-neutral-500">{active.course?.title}</p></div>
            <div className="flex items-center gap-2"><span className={`hidden text-xs sm:inline ${connected ? 'text-success-600' : 'text-neutral-500'}`}>{connected ? 'Connected' : 'Offline'}</span><button type="button" disabled={actionLoading} onClick={() => void updateConversation(active.blockedAt ? 'unblock' : 'block')} className="text-xs font-medium text-neutral-600 hover:text-primary-700 disabled:opacity-50">{active.blockedAt ? 'Unblock' : 'Block'}</button><button type="button" disabled={actionLoading} onClick={() => void updateConversation('delete')} className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50">Delete</button></div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
            {messages.map((message) => <div key={message.id} className={`group flex ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${message.senderId === userId ? 'bg-primary-700 text-white' : 'bg-white text-neutral-800 shadow-sm'}`}><p>{message.content}</p><div className="mt-1 flex items-center justify-between gap-3 text-[10px] opacity-70"><span>{formatTime(message.createdAt)}</span>{message.senderId === userId && !message.deletedAt && <button type="button" onClick={() => void deleteMessage(message.id)}>Delete</button>}</div></div></div>)}
            {messages.length === 0 && <p className="m-auto text-sm text-neutral-500">Start the conversation.</p>}
          </div>
          {error && <p className="border-t border-neutral-200 px-4 py-2 text-sm text-red-600">{error}</p>}
          {active.blockedAt ? <p className="border-t border-neutral-200 p-4 text-center text-sm font-medium text-red-600">Chat blocked</p> : <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} className="flex gap-2 border-t border-neutral-200 p-3"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a message..." className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-primary-500" maxLength={5000} /><button type="submit" disabled={sending || !text.trim()} className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Sending...' : 'Send'}</button></form>}
        </> : <div className="m-auto text-center text-neutral-500">Select a conversation</div>}
      </section>
    </div>
  );
}
