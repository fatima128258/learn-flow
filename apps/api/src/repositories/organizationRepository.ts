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

const organizationListInclude = {
  ...organizationAdminInclude,
  _count: {
    select: { users: true },
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
  const [organizations, activeOrganizations, suspendedOrganizations, users, organizationAdmins] = await Promise.all([
    prisma().organization.count(),
    prisma().organization.count({ where: { status: 'ACTIVE' } }),
    prisma().organization.count({ where: { status: 'SUSPENDED' } }),
    prisma().user.count(),
    prisma().userOrganization.count({ where: { role: 'ORG_ADMIN' } }),
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
