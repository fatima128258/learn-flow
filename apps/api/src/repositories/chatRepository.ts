import getPrisma from '../prisma';

const db = () => getPrisma();

export const findConversation = (id: string, organizationId?: string) => db().conversation.findFirst({ where: { id, ...(organizationId ? { organizationId } : {}), deletedAt: null } });
export const findForCourse = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.findFirst({ where: { organizationId, courseId, studentId, instructorId, deletedAt: null } });
export const findDeletedForCourse = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.findFirst({ where: { organizationId, courseId, studentId, instructorId, deletedAt: { not: null } } });
export const restoreConversation = (id: string) =>
  db().conversation.update({ where: { id }, data: { deletedAt: null, blockedAt: null, blockedById: null, updatedAt: new Date() } });
export const createConversation = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.create({ data: { organizationId, courseId, studentId, instructorId } });
export const listConversations = (organizationId: string, userId: string) => db().conversation.findMany({
  where: { organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] },
  include: { course: { select: { id: true, title: true } }, student: { select: { id: true, name: true, email: true } }, instructor: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
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
export const blockConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { blockedAt: new Date(), blockedById: userId } });
export const unblockConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { blockedAt: null, blockedById: null } });
export const deleteConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { deletedAt: new Date() } });
export const deleteMessage = (id: string, organizationId: string, senderId: string) =>
  db().message.updateMany({ where: { id, senderId, deletedAt: null, conversation: { organizationId, deletedAt: null } }, data: { deletedAt: new Date(), content: '[deleted]' } });
