import * as repo from '../repositories/auditLogRepository';
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
  actorEmail?: string | null;
  actorRole?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

function toAuditLogDto(log: any) {
  return {
    id: log.id,
    action: log.action,
    organizationId: log.organizationId ?? null,
    actor: {
      userId: log.actorUserId,
      email: log.actorEmail ?? null,
      role: log.actorRole ?? null,
    },
    resource: {
      type: log.resourceType ?? null,
      id: log.resourceId ?? null,
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
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: (input.metadata ?? null) as any,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
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

export async function listAuditLogs(input: ListAuditLogsInput = {}) {
  const { page, limit, skip, take } = parsePagination(input);

  const options: repo.ListAuditLogsOptions = {
    organizationId: input.organizationId ?? null,
    action: optionalString(input.action),
    actorUserId: optionalString(input.actorUserId),
    actorEmail: optionalString(input.actorEmail),
    resourceType: optionalString(input.resourceType),
    resourceId: optionalString(input.resourceId),
    from: parseDateFilter(input.from),
    to: parseDateFilter(input.to),
    skip,
    take,
  };

  const [items, total] = await Promise.all([
    repo.list(options),
    repo.count(options),
  ]);

  return {
    items: items.map(toAuditLogDto),
    meta: buildMeta(page, limit, total),
  };
}