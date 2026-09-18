'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { PageLoader } from '@/components/ui/Spinner';

export default function OrganizationChatPage() {
  const { data: user } = useCurrentUser();
  if (!user?.organizationId) {
    return <PageLoader label="Loading chat..." />;
  }
  return <ChatPanel organizationId={user.organizationId} userId={user.id} />;
}
