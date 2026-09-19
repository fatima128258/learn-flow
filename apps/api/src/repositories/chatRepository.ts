import getPrisma from '../prisma';

const db = () => getPrisma();
const MAX_CONVERSATIONS_PER_REQUEST = 100;

export const findConversation = (id: string, organizationId?: string) => db().conversation.findFirst({ where: { id, ...(organizationId ? { organizationId } : {}), deletedAt: null } });
export const findForCourse = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.findFirst({ where: { organizationId, courseId, studentId, instructorId, deletedAt: null } });
export const findDeletedForCourse = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.findFirst({ where: { organizationId, courseId, studentId, instructorId, deletedAt: { not: null } } });
export const restoreConversation = (id: string) =>
  db().conversation.update({ where: { id }, data: { deletedAt: null, blockedAt: null, blockedById: null, updatedAt: new Date() } });
export const createConversation = (organizationId: string, courseId: string, studentId: string, instructorId: string) =>
  db().conversation.create({ data: { organizationId, courseId, studentId, instructorId } });
export const listConversations = (organizationId: string, userId: string, organizationAdmin = false) => db().conversation.findMany({
  where: { organizationId, deletedAt: null, ...(organizationAdmin ? {} : { OR: [{ studentId: userId }, { instructorId: userId }] }) },
  take: MAX_CONVERSATIONS_PER_REQUEST,
  include: {
    course: { select: { id: true, title: true } },
    student: { select: { id: true, name: true, email: true } },
    instructor: { select: { id: true, name: true, email: true } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        content: true,
        readAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  },
  orderBy: { updatedAt: 'desc' },
});
export const countUnread = (conversationId: string, userId: string) =>
  db().message.count({ where: { conversationId, senderId: { not: userId }, readAt: null, deletedAt: null } });
export async function countUnreadByConversation(conversationIds: string[], userId: string) {
  if (conversationIds.length === 0) return new Map<string, number>();
  const rows = await db().message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversationIds },
      senderId: { not: userId },
      readAt: null,
      deletedAt: null,
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.conversationId, row._count._all]));
}
export const countUnreadForUser = (organizationId: string, userId: string) =>
  db().message.count({
    where: {
      senderId: { not: userId },
      readAt: null,
      deletedAt: null,
      conversation: {
        organizationId,
        deletedAt: null,
        OR: [{ studentId: userId }, { instructorId: userId }],
      },
    },
  });
export const listMessages = (conversationId: string, take: number, cursor?: string) => db().message.findMany({
  where: { conversationId },
  include: { replyTo: { select: { id: true, senderId: true, content: true, deletedAt: true } } },
  orderBy: { createdAt: 'desc' },
  take: take + 1,
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
});
export const createMessage = (conversationId: string, senderId: string, content: string, replyToId?: string) =>
  db().$transaction([
    db().message.create({
      data: { conversationId, senderId, content, ...(replyToId ? { replyToId } : {}) },
      include: { replyTo: { select: { id: true, senderId: true, content: true, deletedAt: true } } },
    }),
    db().conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]).then(([message]) => message);
export async function markRead(conversationId: string, userId: string) {
  const unread = await db().message.findMany({
    where: { conversationId, senderId: { not: userId }, readAt: null, deletedAt: null },
    select: { id: true },
  });
  if (unread.length > 0) {
    await db().message.updateMany({
      where: { id: { in: unread.map((message) => message.id) } },
      data: { readAt: new Date() },
    });
  }
  return unread.map((message) => message.id);
}
export const blockConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { blockedAt: new Date(), blockedById: userId } });
export const unblockConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, blockedById: userId }, data: { blockedAt: null, blockedById: null } });
export const deleteConversation = (id: string, organizationId: string, userId: string) =>
  db().conversation.updateMany({ where: { id, organizationId, deletedAt: null, OR: [{ studentId: userId }, { instructorId: userId }] }, data: { deletedAt: new Date() } });
export const deleteMessage = (id: string, organizationId: string, conversationId: string, senderId: string) =>
  db().message.updateMany({
    where: { id, conversationId, senderId, deletedAt: null, conversation: { organizationId, deletedAt: null } },
    data: { deletedAt: new Date(), content: '[deleted]' },
  });
