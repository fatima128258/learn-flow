import getPrisma from '../prisma';

const db = () => getPrisma();

export const findConversation = (id: string) => db().conversation.findUnique({ where: { id } });
export const findForCourse = (courseId: string, studentId: string, instructorId: string) =>
  db().conversation.findUnique({ where: { courseId_studentId_instructorId: { courseId, studentId, instructorId } } });
export const createConversation = (courseId: string, studentId: string, instructorId: string) =>
  db().conversation.create({ data: { courseId, studentId, instructorId } });
export const listConversations = (userId: string) => db().conversation.findMany({
  where: { OR: [{ studentId: userId }, { instructorId: userId }] },
  include: { course: { select: { id: true, title: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  orderBy: { updatedAt: 'desc' },
});
export const listMessages = (conversationId: string, take: number, cursor?: string) => db().message.findMany({
  where: { conversationId },
  orderBy: { createdAt: 'desc' },
  take: take + 1,
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
});
export const createMessage = (conversationId: string, senderId: string, content: string) =>
  db().$transaction(async (tx) => {
    const message = await tx.message.create({ data: { conversationId, senderId, content } });
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  });
export const markRead = (conversationId: string, userId: string) =>
  db().message.updateMany({ where: { conversationId, senderId: { not: userId }, readAt: null, deletedAt: null }, data: { readAt: new Date() } });
export const blockConversation = (id: string, userId: string) =>
  db().conversation.updateMany({ where: { id, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { blockedAt: new Date(), blockedById: userId } });
export const deleteMessage = (id: string, senderId: string) =>
  db().message.updateMany({ where: { id, senderId, deletedAt: null }, data: { deletedAt: new Date(), content: '[deleted]' } });
