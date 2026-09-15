import { EventEmitter } from 'events';

export type ConversationChange = {
  type: 'blocked' | 'unblocked' | 'deleted';
  conversationId: string;
  organizationId: string;
  studentId: string;
  instructorId: string;
};

export type MessageChange =
  | { type: 'deleted'; conversationId: string; organizationId: string; messageId: string }
  | { type: 'read'; conversationId: string; organizationId: string; messageIds: string[]; readerId: string };

export const chatEvents = new EventEmitter();
