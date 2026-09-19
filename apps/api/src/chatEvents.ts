import { EventEmitter } from 'events';

export type ConversationChange = {
  type: 'blocked' | 'unblocked' | 'deleted';
  conversationId: string;
  organizationId: string;
  studentId: string;
  instructorId: string;
  blockedById?: string;
};

export type MessageChange =
  | { type: 'created'; conversationId: string; organizationId: string; message: { id: string; conversationId: string; senderId: string; content: string; readAt: Date | null; deletedAt: Date | null; createdAt: Date; updatedAt: Date } }
  | { type: 'deleted'; conversationId: string; organizationId: string; messageId: string }
  | { type: 'read'; conversationId: string; organizationId: string; messageIds: string[]; readerId: string };

export const chatEvents = new EventEmitter();
