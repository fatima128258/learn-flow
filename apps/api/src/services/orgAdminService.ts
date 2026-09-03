import argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import * as orgRepo from '../repositories/organizationRepository';
import * as orgAdminRepo from '../repositories/orgAdminRepository';
import { dispatchNotification } from './notificationDispatcher';

// Temporary inline validation functions
function isValidEmail(email: string) {
  if (typeof email !== 'string') return false;
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
}

function isValidPassword(password: string) {
  if (typeof password !== 'string') return false;
  return password.length >= 8;
}
import * as authRepo from '../repositories/authRepository';

const MANAGED_ROLES: UserRole[] = ['INSTRUCTOR', 'STUDENT'];

function toMemberDto(membership: {
  role: string;
  organizationId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    emailVerified: membership.user.emailVerified,
    role: membership.role,
    organizationId: membership.organizationId,
    createdAt: membership.user.createdAt,
    updatedAt: membership.user.updatedAt,
  };
}

function toOrganizationDto(organization: {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

function assertManagedRole(role: string): asserts role is 'INSTRUCTOR' | 'STUDENT' {
  if (role !== 'INSTRUCTOR' && role !== 'STUDENT') {
    throw new Error('ROLE_NOT_ALLOWED');
  }
}

export async function getDashboard(organizationId: string) {
  const [organization, counts] = await Promise.all([
    orgRepo.findOrganizationById(organizationId),
    orgAdminRepo.getOrganizationMemberCounts(organizationId),
  ]);

  if (!organization) {
    throw new Error('ORGANIZATION_NOT_FOUND');
  }

  return {
    organization: toOrganizationDto(organization),
    users: {
      total: counts.total,
      instructors: counts.instructors,
      students: counts.students,
      organizationAdmins: counts.orgAdmins,
    },
  };
}

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Org Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
  PLATFORM_ADMIN: 'Platform Admin',
};

const ROLE_ORDER = ['ORG_ADMIN', 'PLATFORM_ADMIN', 'INSTRUCTOR', 'STUDENT'];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

function buildMemberGrowth(monthlyData: Array<{ yearMonth: string; count: number }>) {
  if (monthlyData.length === 0) return [];

  // Generate the last 12 months
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = date.toISOString().slice(0, 7); // YYYY-MM format
    months.push(key);
  }

  // Build a map of year-month -> count from aggregated data
  const countsByMonth = new Map<string, number>();
  for (const row of monthlyData) {
    countsByMonth.set(row.yearMonth, row.count);
  }

  // Build cumulative growth chart
  let running = 0;
  return months.map((yearMonth) => {
    running += countsByMonth.get(yearMonth) ?? 0;
    const date = new Date(`${yearMonth}-01T00:00:00.000Z`);
    return {
      month: monthLabel(yearMonth),
      members: running
    };
  });
}

function buildRoleDistribution(roleCounts: Array<{ role: string; count: number }>) {
  const byRole = new Map(roleCounts.map((r) => [r.role, r.count]));
  return ROLE_ORDER.filter((role) => (byRole.get(role) ?? 0) > 0).map((role) => ({
    label: ROLE_LABELS[role] ?? role,
    role,
    value: byRole.get(role) ?? 0,
  }));
}

export async function getAnalytics(organizationId: string) {
  const organization = await orgRepo.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('ORGANIZATION_NOT_FOUND');
  }

  const [roleCounts, history] = await Promise.all([
    orgAdminRepo.getOrganizationMemberCountByRole(organizationId),
    orgAdminRepo.getOrganizationMembershipHistory(organizationId),
  ]);

  return {
    organization: {
      id: organizationId,
      name: organization.name,
    },
    growth: buildMemberGrowth(history),
    roles: buildRoleDistribution(roleCounts),
  };
}

export async function getOrganization(organizationId: string) {
  const organization = await orgRepo.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('ORGANIZATION_NOT_FOUND');
  }
  return toOrganizationDto(organization);
}

export async function listUsers(organizationId: string, input: {
  page?: number;
  limit?: number;
  role?: string;
}) {
  const page = Number.isFinite(input.page) && Number(input.page) > 0 ? Math.floor(Number(input.page)) : 1;
  const limitRaw = Number.isFinite(input.limit) && Number(input.limit) > 0 ? Math.floor(Number(input.limit)) : 20;
  const limit = Math.min(100, limitRaw);

  let role: UserRole | undefined;
  if (input.role) {
    if (input.role !== 'INSTRUCTOR' && input.role !== 'STUDENT' && input.role !== 'ORG_ADMIN') {
      throw new Error('INVALID_ROLE');
    }
    role = input.role;
  }

  const { items, total } = await orgAdminRepo.listOrganizationMembers({
    organizationId,
    skip: (page - 1) * limit,
    take: limit,
    role,
  });

  return {
    items: items.map(toMemberDto),
    meta: { page, limit, total },
  };
}

export async function getUser(organizationId: string, userId: string) {
  const membership = await orgAdminRepo.findOrganizationMember(organizationId, userId);
  if (!membership) {
    throw new Error('USER_NOT_FOUND');
  }
  return toMemberDto(membership);
}

export async function createManagedUser(organizationId: string, input: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  requestedRole: 'INSTRUCTOR' | 'STUDENT';
}) {
  if (input.role && String(input.role).toUpperCase() !== input.requestedRole) {
    throw new Error('ROLE_NOT_ALLOWED');
  }

  if (!input.email) {
    throw new Error('MISSING_FIELDS');
  }
  if (!isValidEmail(input.email)) {
    throw new Error('INVALID_EMAIL');
  }

  const email = input.email.trim().toLowerCase();
  const organization = await orgRepo.findOrganizationById(organizationId);
  if (!organization) {
    throw new Error('ORGANIZATION_NOT_FOUND');
  }

  let user = await authRepo.findUserByEmail(email);
  let createdNew = false;
  if (!user) {
    if (!input.password) {
      throw new Error('MISSING_FIELDS');
    }
    if (!isValidPassword(input.password)) {
      throw new Error('PASSWORD_TOO_SHORT');
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    user = await authRepo.createUser({
      name: input.name ?? null,
      email,
      passwordHash,
    });
    await authRepo.markUserEmailAsVerified(user.id);
    user = await authRepo.findUserById(user.id);
    createdNew = true;
  }

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const existingMembership = await orgAdminRepo.findOrganizationMember(organizationId, user.id);
  if (existingMembership) {
    throw new Error('USER_ALREADY_IN_ORGANIZATION');
  }

  const membership = await orgAdminRepo.createOrganizationMembership({
    userId: user.id,
    organizationId,
    role: input.requestedRole,
  });

  if (createdNew) {
    await dispatchNotification({
      type: 'WELCOME',
      title: `🎉 Welcome, ${user.name || 'Student'}!`,
      body: `Your learning journey begins now! Explore courses, complete lessons, and unlock certificates. Let's achieve great things together! 🚀`,
      data: { organizationName: organization.name },
      userId: user.id,
      organizationId,
      email: { name: user.name },
    });
  }

  return toMemberDto(membership);
}

export async function updateManagedUser(organizationId: string, userId: string, input: {
  name?: string;
  role?: string;
}) {
  const membership = await orgAdminRepo.findOrganizationMember(organizationId, userId);
  if (!membership) {
    throw new Error('USER_NOT_FOUND');
  }

  if (!MANAGED_ROLES.includes(membership.role)) {
    throw new Error('ROLE_NOT_ALLOWED');
  }

  const nextRole = input.role !== undefined ? String(input.role).toUpperCase() : undefined;
  if (nextRole !== undefined) {
    assertManagedRole(nextRole);
  }

  const nextName = input.name !== undefined
    ? (typeof input.name === 'string' ? input.name.trim() : '')
    : undefined;
  if (nextName !== undefined && !nextName) {
    throw new Error('MISSING_FIELDS');
  }

  if (nextName === undefined && nextRole === undefined) {
    throw new Error('MISSING_FIELDS');
  }

  if (nextName !== undefined) {
    await authRepo.updateUserProfile(userId, { name: nextName });
  }

  if (nextRole !== undefined && nextRole !== membership.role) {
    await orgAdminRepo.updateOrganizationMembershipRole(organizationId, userId, nextRole);
  }

  const refreshed = await orgAdminRepo.findOrganizationMember(organizationId, userId);
  if (!refreshed) {
    throw new Error('USER_NOT_FOUND');
  }
  return toMemberDto(refreshed);
}
