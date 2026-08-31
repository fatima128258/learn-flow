import * as repo from '../repositories/auditLogRepository';
import getPrisma from '../prisma';
import { Prisma } from '@prisma/client';
import { parsePagination, buildMeta } from '../utils/pagination';

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  ORGANIZATION_CREATED: 'ORGANIZATION_CREATED',
  COURSE_PUBLISHED: 'COURSE_PUBLISHED',
  ENROLLMENT_CREATED: 'ENROLLMENT_CREATED',
  CERTIFICATE_GENERATED: 'CERTIFICATE_GENERATED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditEventInput {
  action: string;
  organizationId?: string | null;
  actorUserId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

interface AuditLogRecord {
  id: string;
  action: string;
  organizationId?: string | null;
  actorUserId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: unknown;
  ipAddress?: string | null;
  createdAt: Date;
}

function resourceDisplayName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.courseTitle === 'string' && m.courseTitle) return m.courseTitle;
  const course = m.course;
  if (course && typeof course === 'object') {
    const courseRecord = course as Record<string, unknown>;
    if (typeof courseRecord.title === 'string' && courseRecord.title) return courseRecord.title;
  }
  if (typeof m.name === 'string' && m.name) return m.name;
  return null;
}

function toAuditLogDto(log: AuditLogRecord, organizationName?: string | null) {
  return {
    id: log.id,
    action: log.action,
    organization: {
      id: log.organizationId ?? null,
      name: organizationName ?? null,
    },
    actor: {
      userId: log.actorUserId,
      name: log.actorName ?? null,
      email: log.actorEmail ?? null,
      role: log.actorRole ?? null,
    },
    resource: {
      type: log.resourceType ?? null,
      id: log.resourceId ?? null,
      name: resourceDisplayName(log.metadata),
    },
    metadata: log.metadata ?? null,
    ipAddress: log.ipAddress ?? null,
    createdAt: log.createdAt,
  };
}

/**
 * Records an audit event. Never throws so audit logging can never break
 * the business flow it is called from.
 */
export async function record(input: AuditEventInput) {
  try {
    await repo.create({
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId,
      actorName: input.actorName ?? null,
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: (input.metadata ?? null) as unknown as Prisma.InputJsonValue | null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
  return null;
}

export interface ListAuditLogsInput {
  organizationId?: string | null;
  page?: unknown;
  limit?: unknown;
  action?: unknown;
  actorUserId?: unknown;
  actorEmail?: unknown;
  resourceType?: unknown;
  resourceId?: unknown;
  search?: unknown;
  from?: unknown;
  to?: unknown;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('INVALID_FILTER');
  }
  return value.trim();
}

function parseDateFilter(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_DATE_FILTER');
  }
  return date;
}

async function orgNameByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const orgs = await getPrisma().organization.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(orgs.map((o) => [o.id, o.name]));
}

export async function listAuditLogs(input: ListAuditLogsInput = {}) {
  const { page, limit, skip, take } = parsePagination(input);

  const options: repo.ListAuditLogsOptions = {
    organizationId: input.organizationId ?? null,
    action: optionalString(input.action),
    actorUserId: optionalString(input.actorUserId),
    actorEmail: optionalString(input.actorEmail),
    resourceType: optionalString(input.resourceType),
    resourceId: optionalString(input.resourceId),
    search: optionalString(input.search),
    from: parseDateFilter(input.from),
    to: parseDateFilter(input.to),
    skip,
    take,
  };

  const [items, total] = await Promise.all([
    repo.list(options),
    repo.count(options),
  ]);

  const orgNames = await orgNameByIds(items.map((i) => i.organizationId ?? ''));

  return {
    items: items.map((log) => toAuditLogDto(log, orgNames.get(log.organizationId ?? '') ?? null)),
    meta: buildMeta(page, limit, total),
  };
}