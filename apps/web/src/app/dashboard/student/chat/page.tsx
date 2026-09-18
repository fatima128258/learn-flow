'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useSearchParams } from 'next/navigation';
import { PageLoader } from '@/components/ui/Spinner';

export default function StudentChatPage() {
  const { data: user } = useCurrentUser();
  const searchParams = useSearchParams();
  if (!user?.organizationId) return <PageLoader label="Loading chat..." />;
  return <ChatPanel organizationId={user.organizationId} userId={user.id} courseId={searchParams.get('courseId') || undefined} />;
}
