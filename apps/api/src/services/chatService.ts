import * as repo from '../repositories/chatRepository';
import getPrisma from '../prisma';

const fail = (message: string): never => { throw new Error(message); };

async function authorizeCourse(orgId: string, courseId: string, userId: string, role?: string) {
  const db = getPrisma();
  const course = await db.course.findFirst({ where: { id: courseId, organizationId: orgId } });
  if (!course) throw new Error('COURSE_NOT_FOUND');
  if (role === 'INSTRUCTOR' || role === 'ORG_ADMIN') {
    if (role === 'INSTRUCTOR' && course.instructorUserId !== userId) throw new Error('FORBIDDEN');
    return course;
  }
  const enrollment = await db.enrollment.findFirst({ where: { courseId, organizationId: orgId, userId, status: 'ACTIVE' } });
  if (!enrollment) throw new Error('ENROLLMENT_REQUIRED');
  return course;
}

export async function open(orgId: string, courseId: string, userId: string, role?: string, requestedStudentId?: string) {
  const course = await authorizeCourse(orgId, courseId, userId, role);
  const studentId = role === 'INSTRUCTOR' || role === 'ORG_ADMIN'
    ? requestedStudentId
      ?? (await getPrisma().enrollment.findFirst({ where: { courseId, organizationId: orgId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }))?.userId
    : userId;
  if (!studentId) throw new Error('ENROLLMENT_REQUIRED');
  const enrolled = await getPrisma().enrollment.findFirst({
    where: { courseId, organizationId: orgId, userId: studentId, status: 'ACTIVE' },
  });
  if (!enrolled) throw new Error('ENROLLMENT_REQUIRED');
  const instructorId = course.instructorUserId;
  const existing = await repo.findForCourse(orgId, courseId, studentId, instructorId);
  if (existing) return existing;
  const deleted = await repo.findDeletedForCourse(orgId, courseId, studentId, instructorId);
  return deleted
    ? repo.restoreConversation(deleted.id)
    : repo.createConversation(orgId, courseId, studentId, instructorId);
}

export async function list(orgId: string, userId: string, role?: string) {
  return repo.listConversations(orgId, userId, role === 'ORG_ADMIN');
}

async function participant(orgId: string | undefined, id: string, userId: string, role?: string) {
  const c = await repo.findConversation(id, orgId);
  if (!c) throw new Error('CONVERSATION_NOT_FOUND');
  const db = getPrisma();
  if (role === 'ORG_ADMIN' || (c.studentId !== userId && c.instructorId !== userId)) {
    const admin = await db.userOrganization.findFirst({ where: { userId, organizationId: c.organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' } });
    if (!admin) throw new Error('FORBIDDEN');
    return c;
  }
  if (c.studentId !== userId && c.instructorId !== userId) throw new Error('FORBIDDEN');
  if (c.studentId === userId) {
    const enrollment = await db.enrollment.findFirst({
      where: {
        userId,
        courseId: c.courseId,
        organizationId: c.organizationId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new Error('ENROLLMENT_REQUIRED');
  } else {
    const course = await db.course.findFirst({
      where: { id: c.courseId, organizationId: c.organizationId, instructorUserId: userId },
    });
    if (!course) throw new Error('FORBIDDEN');
  }
  return c;
}

export async function authorizeSocketConversation(id: string, userId: string) {
  const membership = await getPrisma().userOrganization.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: { role: true },
  });
  const conversation = await participant(undefined, id, userId, membership?.role);
  return conversation.organizationId;
}
export async function messages(orgId: string | undefined, id: string, userId: string, limit = 50, cursor?: string, role?: string) {
  await participant(orgId, id, userId, role);
  const rows = await repo.listMessages(id, Math.min(Math.max(limit, 1), 100), cursor);
  const hasMore = rows.length > Math.min(Math.max(limit, 1), 100);
  return { messages: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[rows.length - 1].id : null };
}
export async function send(orgId: string | undefined, id: string, userId: string, content: string, role?: string) {
  const c = await participant(orgId, id, userId, role);
  if (c.blockedAt) throw new Error('CONVERSATION_BLOCKED');
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 5000) throw new Error('INVALID_CONTENT');
  return repo.createMessage(id, userId, content.trim());
}
export async function read(orgId: string | undefined, id: string, userId: string, role?: string) { await participant(orgId, id, userId, role); return repo.markRead(id, userId); }
export async function block(orgId: string, id: string, userId: string, role?: string) { await participant(orgId, id, userId, role); return repo.blockConversation(id, orgId, userId); }
export async function unblock(orgId: string, id: string, userId: string, role?: string) { await participant(orgId, id, userId, role); return repo.unblockConversation(id, orgId, userId); }
export async function removeConversation(orgId: string, id: string, userId: string, role?: string) { await participant(orgId, id, userId, role); return repo.deleteConversation(id, orgId, userId); }
export async function removeMessage(orgId: string, id: string, userId: string) { return repo.deleteMessage(id, orgId, userId); }
