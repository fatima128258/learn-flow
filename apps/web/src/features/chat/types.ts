export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatConversation = {
  id: string;
  courseId: string;
  studentId: string;
  instructorId: string;
  blockedAt: string | null;
  blockedById: string | null;
  createdAt: string;
  updatedAt: string;
  course?: { id: string; title: string };
  student?: { id: string; name: string | null; email: string };
  instructor?: { id: string; name: string | null; email: string };
  messages?: ChatMessage[];
};

export type ChatListResponse = { success: boolean; data: ChatConversation[] };
export type ChatMessagesResponse = {
  success: boolean;
  data: { messages: ChatMessage[]; nextCursor: string | null };
};
