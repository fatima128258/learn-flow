'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { OrganizationPageLoader } from '@/components/ui';

export default function OrganizationChatPage() {
  const { data: user } = useCurrentUser();
  if (!user?.organizationId) {
    return <OrganizationPageLoader />;
  }
  return <ChatPanel organizationId={user.organizationId} userId={user.id} />;
}
