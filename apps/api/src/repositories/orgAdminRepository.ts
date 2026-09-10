import { Prisma, UserRole } from '@prisma/client';
import getPrisma from '../prisma';

function prisma() {
  return getPrisma();
}

const memberUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
};

export async function getOrganizationMemberCounts(organizationId: string) {
  // Use a single groupBy query instead of 4 separate count queries
  const rows = await prisma().userOrganization.groupBy({
    by: ['role'],
    where: { organizationId },
    _count: { _all: true },
  });

  // Build a map of role → count
  const counts: Record<string, number> = {};
  let total = 0;
  
  for (const row of rows) {
    const count = row._count._all;
    counts[row.role] = count;
    // Only count managed roles (ORG_ADMIN, INSTRUCTOR, STUDENT) in total
    if (['ORG_ADMIN', 'INSTRUCTOR', 'STUDENT'].includes(row.role)) {
      total += count;
    }
  }

  return {
    total,
    instructors: counts.INSTRUCTOR ?? 0,
    students: counts.STUDENT ?? 0,
    orgAdmins: counts.ORG_ADMIN ?? 0,
  };
}

export async function getOrganizationMemberCountByRole(organizationId: string) {
  const rows = await prisma().userOrganization.groupBy({
    by: ['role'],
    where: { organizationId },
    _count: { _all: true },
  });

  return rows.map((row) => ({ role: row.role, count: row._count._all }));
}

export async function getOrganizationMembershipHistory(organizationId: string) {
  // Load membership dates for the current month so the service can fill
  // zero-activity days and build a daily cumulative chart.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const memberships = (await prisma().userOrganization.findMany({
    where: { organizationId },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })) ?? [];
  const initialCount = memberships.filter((membership) => membership.createdAt < monthStart).length;
  const countsByDay = new Map<string, number>();
  for (const membership of memberships) {
    if (membership.createdAt >= monthStart) {
      const key = membership.createdAt.toISOString().slice(0, 10);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }
  }
  return {
    initialCount,
    daily: Array.from(countsByDay, ([date, count]) => ({ date, count })),
  };
}

type EnrollmentTotalsRow = { total: bigint; enrolled_students: bigint; not_started: bigint; in_progress: bigint; completed: bigint };
type CourseStatusTotalsRow = { published: bigint; draft: bigint };
type EnrollmentTrendRow = { date: string; count: bigint };
type CoursePerformanceRow = {
  course_id: string; course_name: string; category: string | null; instructor: string | null; status: string;
  enrollments: bigint; not_started: bigint; in_progress: bigint; completed: bigint;
};

/**
 * All enrollment analytics use course.organizationId in addition to the
 * enrollment tenant field. This prevents stale or malformed enrollment rows
 * from crossing an organization's course boundary.
 */
export async function getEnrollmentAnalytics(organizationId: string, start: Date, end: Date) {
  const [totalsRows, courseStatusRows, trendRows, performanceRows] = await Promise.all([
    prisma().$queryRaw<EnrollmentTotalsRow[]>`
      SELECT COUNT(*) AS total, COUNT(DISTINCT e."userId") AS enrolled_students,
        COUNT(*) FILTER (WHERE cp.id IS NULL AND e.status <> 'COMPLETED') AS not_started,
        COUNT(*) FILTER (WHERE cp.id IS NOT NULL AND NOT cp.completed AND e.status <> 'COMPLETED') AS in_progress,
        COUNT(*) FILTER (WHERE cp.completed OR e.status = 'COMPLETED') AS completed
      FROM "Enrollment" e
      INNER JOIN "Course" c ON c.id = e."courseId" AND c."organizationId" = ${organizationId}
      LEFT JOIN "CourseProgress" cp ON cp."courseId" = e."courseId" AND cp."userId" = e."userId" AND cp."organizationId" = ${organizationId}
      WHERE e."organizationId" = ${organizationId}
    `,
    prisma().$queryRaw<CourseStatusTotalsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE c.status = 'PUBLISHED') AS published,
        COUNT(*) FILTER (WHERE c.status = 'DRAFT') AS draft
      FROM "Course" c
      WHERE c."organizationId" = ${organizationId}
    `,
    prisma().$queryRaw<EnrollmentTrendRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date, COUNT(*) AS count
      FROM "Enrollment" e
      INNER JOIN "Course" c ON c.id = e."courseId" AND c."organizationId" = ${organizationId}
      WHERE e."organizationId" = ${organizationId} AND e."enrolledAt" >= ${start} AND e."enrolledAt" < ${end}
      GROUP BY DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC')
      ORDER BY DATE_TRUNC('day', e."enrolledAt" AT TIME ZONE 'UTC') ASC
    `,
    prisma().$queryRaw<CoursePerformanceRow[]>`
      SELECT c.id AS course_id, c.title AS course_name, cat.name AS category, u.name AS instructor, c.status::text AS status,
        COUNT(e.id) AS enrollments,
        COUNT(e.id) FILTER (WHERE cp.id IS NULL AND e.status <> 'COMPLETED') AS not_started,
        COUNT(e.id) FILTER (WHERE cp.id IS NOT NULL AND NOT cp.completed AND e.status <> 'COMPLETED') AS in_progress,
        COUNT(e.id) FILTER (WHERE cp.completed OR e.status = 'COMPLETED') AS completed
      FROM "Course" c
      LEFT JOIN "Category" cat ON cat.id = c."categoryId" AND cat."organizationId" = ${organizationId}
      LEFT JOIN "User" u ON u.id = c."instructorUserId"
      LEFT JOIN "Enrollment" e ON e."courseId" = c.id AND e."organizationId" = ${organizationId}
      LEFT JOIN "CourseProgress" cp ON cp."courseId" = e."courseId" AND cp."userId" = e."userId" AND cp."organizationId" = ${organizationId}
      WHERE c."organizationId" = ${organizationId}
      GROUP BY c.id, c.title, cat.name, u.name, c.status
      ORDER BY COUNT(e.id) DESC, c.title ASC
    `,
  ]);

  const totals = totalsRows[0] ?? { total: 0n, enrolled_students: 0n, not_started: 0n, in_progress: 0n, completed: 0n };
  const courseStatusTotals = courseStatusRows[0] ?? { published: 0n, draft: 0n };
  return {
    totals: { total: Number(totals.total), enrolledStudents: Number(totals.enrolled_students), notStarted: Number(totals.not_started), inProgress: Number(totals.in_progress), completed: Number(totals.completed) },
    courses: { published: Number(courseStatusTotals.published), draft: Number(courseStatusTotals.draft) },
    trend: trendRows.map((row) => ({ date: row.date, count: Number(row.count) })),
    coursePerformance: performanceRows.map((row) => {
      const enrollments = Number(row.enrollments);
      const completed = Number(row.completed);
      return {
        courseId: row.course_id, courseName: row.course_name, category: row.category, instructor: row.instructor,
        status: row.status, enrollments, notStarted: Number(row.not_started), inProgress: Number(row.in_progress), completed,
        completionRate: enrollments === 0 ? 0 : Math.round((completed / enrollments) * 10000) / 100,
      };
    }),
  };
}

export async function listOrganizationEnrollments(params: { organizationId: string; search?: string; courseId?: string; status?: string; skip: number; take: number }) {
  const search = params.search?.trim() || null;
  const courseId = params.courseId || null;
  const status = params.status || null;
  const where = Prisma.sql`e."organizationId"=${params.organizationId} AND c."organizationId"=${params.organizationId} AND (${courseId}::text IS NULL OR e."courseId"=${courseId}) AND (${search}::text IS NULL OR u.name ILIKE ${`%${search ?? ''}%`} OR u.email ILIKE ${`%${search ?? ''}%`} OR c.title ILIKE ${`%${search ?? ''}%`}) AND (${status}::text IS NULL OR CASE WHEN cp.completed OR e.status='COMPLETED' THEN 'COMPLETED' WHEN cp.id IS NULL THEN 'NOT_STARTED' ELSE 'IN_PROGRESS' END=${status})`;
  const rows = await prisma().$queryRaw<Array<{ id:string; student_name:string|null; student_email:string; course_id:string; course_name:string; category:string|null; enrolled_at:Date; status:string; progress:bigint }>>`
    SELECT e.id,u.name student_name,u.email student_email,c.id course_id,c.title course_name,cat.name category,e."enrolledAt" enrolled_at,
      CASE WHEN cp.completed OR e.status='COMPLETED' THEN 'COMPLETED' WHEN cp.id IS NULL THEN 'NOT_STARTED' ELSE 'IN_PROGRESS' END status,
      CASE WHEN cp.completed OR e.status='COMPLETED' THEN 100 WHEN totals.total=0 THEN 0 ELSE ROUND(COALESCE(done.completed,0)::numeric*100/totals.total) END progress
    FROM "Enrollment" e JOIN "User" u ON u.id=e."userId" JOIN "Course" c ON c.id=e."courseId"
      LEFT JOIN "Category" cat ON cat.id=c."categoryId" AND cat."organizationId"=${params.organizationId}
      LEFT JOIN "CourseProgress" cp ON cp."userId"=e."userId" AND cp."courseId"=e."courseId" AND cp."organizationId"=${params.organizationId}
      LEFT JOIN LATERAL (SELECT COUNT(*)::int total FROM "Lesson" l JOIN "Module" m ON m.id=l."moduleId" WHERE m."courseId"=c.id) totals ON true
      LEFT JOIN LATERAL (SELECT COUNT(*)::int completed FROM "LessonProgress" lp WHERE lp."userId"=e."userId" AND lp."courseId"=c.id AND lp.completed) done ON true
    WHERE ${where} ORDER BY e."enrolledAt" DESC LIMIT ${params.take} OFFSET ${params.skip}`;
  const counts = await prisma().$queryRaw<Array<{ count:bigint }>>`SELECT COUNT(*) count FROM "Enrollment" e JOIN "User" u ON u.id=e."userId" JOIN "Course" c ON c.id=e."courseId" LEFT JOIN "CourseProgress" cp ON cp."userId"=e."userId" AND cp."courseId"=e."courseId" AND cp."organizationId"=${params.organizationId} WHERE ${where}`;
  return { items: rows.map(r => ({ id:r.id, student:{name:r.student_name,email:r.student_email}, course:{id:r.course_id,name:r.course_name,category:r.category}, enrolledAt:r.enrolled_at,status:r.status,progress:Number(r.progress) })), total:Number(counts[0]?.count ?? 0n) };
}

export async function listOrganizationMembers(params: {
  organizationId: string;
  skip: number;
  take: number;
  role?: UserRole;
}) {
  const where = {
    organizationId: params.organizationId,
    // Exclude ORG_ADMIN from members list
    role: params.role ? params.role : { not: 'ORG_ADMIN' as const },
  };

  const [items, total] = await Promise.all([
    prisma().userOrganization.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: memberUserSelect },
      },
    }),
    prisma().userOrganization.count({ where }),
  ]);

  return { items, total };
}

export async function findOrganizationMember(organizationId: string, userId: string) {
  return prisma().userOrganization.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: { status: true, role: true, organizationId: true, user: { select: memberUserSelect } },
  });
}

export async function getMemberActivityCounts(organizationId: string, userId: string) {
  const rows = await prisma().$queryRaw<Array<{ courses_created: bigint; courses_purchased: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM "Course" WHERE "organizationId" = ${organizationId} AND "instructorUserId" = ${userId}) AS courses_created,
      (SELECT COUNT(*) FROM "Enrollment" WHERE "organizationId" = ${organizationId} AND "userId" = ${userId}) AS courses_purchased
  `;
  const row = rows[0] ?? { courses_created: 0n, courses_purchased: 0n };
  return {
    coursesCreated: Number(row.courses_created),
    coursesPurchased: Number(row.courses_purchased),
  };
}

export async function createOrganizationMembership(data: {
  userId: string;
  organizationId: string;
  role: UserRole;
}) {
  return prisma().userOrganization.create({
    data,
    select: { status: true, role: true, organizationId: true, user: { select: memberUserSelect } },
  });
}

export async function updateOrganizationMembershipRole(
  organizationId: string,
  userId: string,
  role: UserRole,
) {
  return prisma().userOrganization.update({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    data: { role },
    select: { status: true, role: true, organizationId: true, user: { select: memberUserSelect } },
  });
}

export async function updateOrganizationMembershipStatus(
  organizationId: string,
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  return prisma().userOrganization.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { status },
    select: { status: true, role: true, organizationId: true, user: { select: memberUserSelect } },
  });
}
