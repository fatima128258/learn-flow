'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { DashboardSkeleton } from '@/components/ui';

export default function InstructorChatPage() {
  const { data: user } = useCurrentUser();
  if (!user?.organizationId) return <DashboardSkeleton cards={2} />;
  return <ChatPanel organizationId={user.organizationId} userId={user.id} />;
}
