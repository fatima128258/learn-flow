'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useSearchParams } from 'next/navigation';
import { DashboardSkeleton } from '@/components/ui';

export default function StudentChatPage() {
  const { data: user } = useCurrentUser();
  const searchParams = useSearchParams();
  if (!user?.organizationId) return <DashboardSkeleton cards={2} />;
  return <ChatPanel organizationId={user.organizationId} userId={user.id} courseId={searchParams.get('courseId') || undefined} />;
}
