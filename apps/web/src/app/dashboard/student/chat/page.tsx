'use client';

import { ChatPanel } from '@/features/chat/ChatPanel';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui';

export default function StudentChatPage() {
  const { data: user } = useCurrentUser();
  const searchParams = useSearchParams();
  if (!user?.organizationId) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status" aria-label="Loading chat">
        <Spinner size="md" label="Loading..." />
      </div>
    );
  }
  return <ChatPanel organizationId={user.organizationId} userId={user.id} courseId={searchParams.get('courseId') || undefined} />;
}
