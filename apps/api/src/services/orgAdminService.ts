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

function toMemberDto(membership: any) {
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

function toOrganizationDto(organization: any) {
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
      title: `Welcome to ${organization.name}`,
      body: `Your LearnFlow account is ready in ${organization.name}.`,
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
