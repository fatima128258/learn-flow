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
  const [total, instructors, students, orgAdmins] = await Promise.all([
    prisma().userOrganization.count({ where: { organizationId } }),
    prisma().userOrganization.count({ where: { organizationId, role: 'INSTRUCTOR' } }),
    prisma().userOrganization.count({ where: { organizationId, role: 'STUDENT' } }),
    prisma().userOrganization.count({ where: { organizationId, role: 'ORG_ADMIN' } }),
  ]);

  return { total, instructors, students, orgAdmins };
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
  return prisma().userOrganization.findMany({
    where: { organizationId },
    select: { createdAt: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listOrganizationMembers(params: {
  organizationId: string;
  skip: number;
  take: number;
  role?: UserRole;
}) {
  const where = {
    organizationId: params.organizationId,
    ...(params.role ? { role: params.role } : {}),
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
