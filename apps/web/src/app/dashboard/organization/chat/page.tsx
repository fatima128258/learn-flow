'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';

export default function OrganizationChatPage() {
  const { data: user } = useCurrentUser();
  if (!user?.organizationId) {
    return <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-neutral-600">Loading chat...</div>;
  }
  return <ChatPanel organizationId={user.organizationId} userId={user.id} />;
}
