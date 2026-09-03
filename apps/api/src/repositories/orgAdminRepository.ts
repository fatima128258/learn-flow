import { UserRole } from '@prisma/client';
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
  // Aggregate membership growth by month directly in PostgreSQL using groupBy with date bucketing.
  // This avoids loading thousands/millions of rows into Node.js memory.
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);

  // Use raw SQL to aggregate memberships by month
  const results = await prisma().$queryRaw<Array<{ year_month: string; count: bigint }>>`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS year_month,
      COUNT(*) as count
    FROM "UserOrganization"
    WHERE "organizationId" = ${organizationId}
      AND "createdAt" >= ${twelveMonthsAgo}
    GROUP BY DATE_TRUNC('month', "createdAt")
    ORDER BY DATE_TRUNC('month', "createdAt") ASC
  `;

  // Convert BigInt counts to numbers and format as the service expects
  return results.map(row => ({
    yearMonth: row.year_month,
    count: Number(row.count)
  }));
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
    role: params.role ? params.role : { not: 'ORG_ADMIN' },
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
    include: {
      user: { select: memberUserSelect },
    },
  });
}

export async function createOrganizationMembership(data: {
  userId: string;
  organizationId: string;
  role: UserRole;
}) {
  return prisma().userOrganization.create({
    data,
    include: {
      user: { select: memberUserSelect },
    },
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
    include: {
      user: { select: memberUserSelect },
    },
  });
}
