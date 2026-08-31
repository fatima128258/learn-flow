import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import * as orgRepo from '../repositories/organizationRepository';
import * as orgAdminRepo from '../repositories/orgAdminRepository';
import * as authRepo from '../repositories/authRepository';
import { dispatchNotification } from './notificationDispatcher';
import { record as recordAudit } from './auditLogService';

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

function isValidSlug(slug: string) {
  if (typeof slug !== 'string') return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 50;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapPrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new Error('ORGANIZATION_SLUG_TAKEN');
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw new Error('ORGANIZATION_NOT_FOUND');
  }
  throw err;
}

interface OrganizationMembership {
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
  };
}

function toOrganizationDto(organization: {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users?: number };
  users?: OrganizationMembership[];
}) {
  const admins = Array.isArray(organization.users)
    ? organization.users.map((membership: OrganizationMembership) => ({
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        emailVerified: membership.user.emailVerified,
        role: membership.role,
      }))
    : undefined;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    ...(organization._count ? { memberCount: organization._count.users } : {}),
    ...(admins ? { admins } : {}),
  };
}

function normalizeName(name: unknown) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('MISSING_FIELDS');
  }
  return name.trim();
}

function resolveSlug(rawSlug: unknown, name: string) {
  const slug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim().toLowerCase() : slugify(name);
  if (!isValidSlug(slug)) {
    throw new Error('INVALID_SLUG');
  }
  return slug;
}

export async function getDashboardSummary() {
  const [counts, orgsByDay] = await Promise.all([
    orgRepo.getDashboardCounts(),
    orgRepo.getOrganizationsCreatedThisMonth(),
  ]);

  return {
    organizations: {
      total: counts.organizations,
      active: counts.activeOrganizations,
      suspended: counts.suspendedOrganizations,
    },
    users: {
      total: counts.users,
    },
    organizationAdmins: {
      total: counts.organizationAdmins,
    },
    organizationsThisMonth: orgsByDay,
  };
}

export async function createOrganization(
  input: {
    name?: string;
    slug?: string;
    actor?: {
      userId: string;
      name?: string | null;
      email?: string | null;
      role?: string | null;
    } | null;
  },
) {
  const name = normalizeName(input.name);
  const slug = resolveSlug(input.slug, name);

  const existing = await orgRepo.findOrganizationBySlug(slug);
  if (existing) {
    throw new Error('ORGANIZATION_SLUG_TAKEN');
  }

  try {
    const organization = await orgRepo.createOrganization({ name, slug });
    if (input.actor?.userId) {
      await recordAudit({
        action: 'ORGANIZATION_CREATED',
        organizationId: organization.id,
        actorUserId: input.actor.userId,
        actorName: input.actor.name ?? null,
        actorEmail: input.actor.email ?? null,
        actorRole: input.actor.role ?? 'PLATFORM_ADMIN',
        resourceType: 'ORGANIZATION',
        resourceId: organization.id,
        metadata: { name: organization.name, slug: organization.slug },
      });
    }
    return toOrganizationDto(organization);
  } catch (err) {
    mapPrismaError(err);
  }
}

export async function listOrganizations(input: { page?: number; limit?: number; status?: string; q?: string }) {
  const page = Number.isFinite(input.page) && Number(input.page) > 0 ? Math.floor(Number(input.page)) : 1;
  const limitRaw = Number.isFinite(input.limit) && Number(input.limit) > 0 ? Math.floor(Number(input.limit)) : 20;
  const limit = Math.min(100, limitRaw);
  const status = input.status && input.status.length > 0 ? input.status : undefined;
  if (status && status !== 'ACTIVE' && status !== 'SUSPENDED') {
    throw new Error('INVALID_STATUS');
  }

  const { items, total } = await orgRepo.listOrganizations({
    skip: (page - 1) * limit,
    take: limit,
    status: status as 'ACTIVE' | 'SUSPENDED' | undefined,
    q: input.q?.trim() || undefined,
  });

  return {
    items: items.map(toOrganizationDto),
    meta: { page, limit, total },
  };
}

export async function getOrganization(id: string) {
  if (!id) throw new Error('ORGANIZATION_NOT_FOUND');
  const organization = await orgRepo.findOrganizationById(id);
  if (!organization) throw new Error('ORGANIZATION_NOT_FOUND');
  return toOrganizationDto(organization);
}

export async function listOrganizationMembers(organizationId: string, input: { page?: number; limit?: number }) {
  if (!organizationId) throw new Error('ORGANIZATION_NOT_FOUND');
  const organization = await orgRepo.findOrganizationById(organizationId);
  if (!organization) throw new Error('ORGANIZATION_NOT_FOUND');

  const page = Number.isFinite(input.page) && Number(input.page) > 0 ? Math.floor(Number(input.page)) : 1;
  const limitRaw = Number.isFinite(input.limit) && Number(input.limit) > 0 ? Math.floor(Number(input.limit)) : 20;
  const limit = Math.min(100, limitRaw);

  const { items, total } = await orgAdminRepo.listOrganizationMembers({
    organizationId,
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    organization: toOrganizationDto(organization),
    members: items.map((membership: {
      id: string;
      organizationId: string;
      role: string;
      createdAt: Date;
      user: {
        id: string;
        name: string | null;
        email: string;
        emailVerified: boolean;
      };
    }) => ({
      id: membership.id,
      userId: membership.user.id,
      organizationId: membership.organizationId,
      name: membership.user.name,
      email: membership.user.email,
      emailVerified: membership.user.emailVerified,
      role: membership.role,
      joinedAt: membership.createdAt,
    })),
    meta: { page, limit, total },
  };
}

export async function updateOrganization(id: string, input: { name?: string; slug?: string }) {
  const current = await orgRepo.findOrganizationById(id);
  if (!current) throw new Error('ORGANIZATION_NOT_FOUND');

  const data: { name?: string; slug?: string } = {};
  if (input.name !== undefined) {
    data.name = normalizeName(input.name);
  }
  if (input.slug !== undefined) {
    data.slug = resolveSlug(input.slug, data.name ?? current.name);
  }

  if (!data.name && !data.slug) {
    throw new Error('MISSING_FIELDS');
  }

  if (data.slug && data.slug !== current.slug) {
    const existing = await orgRepo.findOrganizationBySlug(data.slug);
    if (existing) throw new Error('ORGANIZATION_SLUG_TAKEN');
  }

  try {
    const organization = await orgRepo.updateOrganization(id, data);
    return toOrganizationDto(organization);
  } catch (err) {
    mapPrismaError(err);
  }
}

export async function setOrganizationStatus(id: string, status: string) {
  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    throw new Error('INVALID_STATUS');
  }

  const current = await orgRepo.findOrganizationById(id);
  if (!current) throw new Error('ORGANIZATION_NOT_FOUND');

  try {
    const organization = await orgRepo.updateOrganization(id, { status });
    return toOrganizationDto(organization);
  } catch (err) {
    mapPrismaError(err);
  }
}

export async function assignOrganizationAdmin(organizationId: string, input: {
  email?: string;
  userId?: string;
  name?: string;
  password?: string;
  role?: string;
}) {
  if (input.role && String(input.role).toUpperCase() !== 'ORG_ADMIN') {
    throw new Error('ROLE_NOT_ALLOWED');
  }

  const organization = await orgRepo.findOrganizationById(organizationId);
  if (!organization) throw new Error('ORGANIZATION_NOT_FOUND');

  let user = null;
  let createdNew = false;
  if (input.userId) {
    user = await authRepo.findUserById(input.userId);
    if (!user) throw new Error('USER_NOT_FOUND');
  } else if (input.email) {
    if (!isValidEmail(input.email)) throw new Error('INVALID_EMAIL');
    user = await authRepo.findUserByEmail(input.email.trim().toLowerCase());
  } else {
    throw new Error('MISSING_FIELDS');
  }

  if (!user) {
    if (!input.password) throw new Error('MISSING_FIELDS');
    if (!isValidPassword(input.password)) throw new Error('PASSWORD_TOO_SHORT');
    const email = String(input.email).trim().toLowerCase();
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

  if (!user) throw new Error('USER_NOT_FOUND');

  const existingMembership = await orgRepo.findMembership(user.id, organizationId);
  if (existingMembership?.role === 'PLATFORM_ADMIN') {
    throw new Error('ROLE_NOT_ALLOWED');
  }

  const membership = await orgRepo.upsertOrganizationAdmin(user.id, organizationId);

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

  return {
    organizationId,
    role: membership.role,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
    },
  };
}
