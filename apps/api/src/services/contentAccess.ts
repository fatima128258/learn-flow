export interface ContentActor {
  userId?: string;
  role?: string | null;
}

export function isStaffRole(role: string | null | undefined) {
  return role === 'ORG_ADMIN' || role === 'PLATFORM_ADMIN';
}

export function assertCanManage(
  actor: ContentActor | null | undefined,
  course: { instructorUserId: string },
) {
  if (!actor) return;
  const role = actor.role ?? null;
  if (isStaffRole(role)) return;
  if (role === 'INSTRUCTOR' && actor.userId === course.instructorUserId) return;
  throw new Error('FORBIDDEN');
}
