import getPrisma from '../prisma';
import { OrganizationStatus } from '@prisma/client';

function prisma() {
  return getPrisma();
}

const organizationAdminInclude = {
  users: {
    where: { role: 'ORG_ADMIN' as const },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
        },
      },
    },
  },
};

export const SYSTEM_ORGANIZATION_SLUG = 'platform';

const organizationListInclude = {
  ...organizationAdminInclude,
  _count: {
    select: { 
      users: {
        where: { role: { in: ['STUDENT', 'INSTRUCTOR'] as const } }
      }
    },
  },
};

export async function createOrganization(data: { name: string; slug: string; status?: OrganizationStatus }) {
  return prisma().organization.create({
    data: {
      name: data.name,
      slug: data.slug,
      status: data.status ?? 'ACTIVE',
    },
    include: organizationAdminInclude,
  });
}

export async function findOrganizationById(id: string) {
  return prisma().organization.findUnique({
    where: { id },
    include: organizationAdminInclude,
  });
}

export async function findOrganizationBySlug(slug: string) {
  return prisma().organization.findUnique({ where: { slug } });
}

export async function listOrganizations(params: {
  skip: number;
  take: number;
  status?: OrganizationStatus;
  q?: string;
}) {
  const where = {
    slug: { not: SYSTEM_ORGANIZATION_SLUG },
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' as const } },
            { slug: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma().organization.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      include: organizationListInclude,
    }),
    prisma().organization.count({ where }),
  ]);

  return { items, total };
}

export async function updateOrganization(
  id: string,
  data: { name?: string; slug?: string; status?: OrganizationStatus },
) {
  return prisma().organization.update({
    where: { id },
    data,
    include: organizationAdminInclude,
  });
}

export async function getDashboardCounts() {
  const customerOrganizationWhere = { slug: { not: SYSTEM_ORGANIZATION_SLUG } };
  const [organizations, activeOrganizations, suspendedOrganizations, users, organizationAdmins] = await Promise.all([
    prisma().organization.count({ where: customerOrganizationWhere }),
    prisma().organization.count({ where: { ...customerOrganizationWhere, status: 'ACTIVE' } }),
    prisma().organization.count({ where: { ...customerOrganizationWhere, status: 'SUSPENDED' } }),
    prisma().userOrganization.count({ where: { organization: { slug: { not: SYSTEM_ORGANIZATION_SLUG } } } }),
    prisma().userOrganization.count({ where: { role: 'ORG_ADMIN', organization: { slug: { not: SYSTEM_ORGANIZATION_SLUG } } } }),
  ]);

  return {
    organizations,
    activeOrganizations,
    suspendedOrganizations,
    users,
    organizationAdmins,
  };
}

export async function findMembership(userId: string, organizationId: string) {
  return prisma().userOrganization.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
  });
}

export async function upsertOrganizationAdmin(userId: string, organizationId: string) {
  return prisma().userOrganization.upsert({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    update: { role: 'ORG_ADMIN' },
    create: {
      userId,
      organizationId,
      role: 'ORG_ADMIN',
    },
  });
}

export async function getOrganizationsCreatedThisMonth() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const orgs = await prisma().organization.findMany({
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      slug: { not: SYSTEM_ORGANIZATION_SLUG },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by day
  const daysInMonth = endOfMonth.getDate();
  const countsPerDay: Record<number, number> = {};

  // Initialize all days with 0
  for (let day = 1; day <= daysInMonth; day++) {
    countsPerDay[day] = 0;
  }

  // Count organizations per day
  orgs.forEach((org) => {
    const day = org.createdAt.getDate();
    countsPerDay[day] = (countsPerDay[day] || 0) + 1;
  });

  // Convert to array format
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      day,
      count: countsPerDay[day] || 0,
    };
  });
}
