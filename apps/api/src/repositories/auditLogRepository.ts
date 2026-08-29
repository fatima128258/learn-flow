import getPrisma from '../prisma';
import { Prisma } from '@prisma/client';

function prisma() {
  return getPrisma();
}

export interface CreateAuditLogData {
  organizationId?: string | null;
  actorUserId: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export interface ListAuditLogsOptions {
  organizationId?: string | null;
  action?: string;
  actorUserId?: string;
  actorEmail?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

function listWhere(options: ListAuditLogsOptions): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (options.organizationId) {
    where.organizationId = options.organizationId;
  }
  if (options.action) {
    where.action = options.action;
  }
  if (options.actorUserId) {
    where.actorUserId = options.actorUserId;
  }
  if (options.actorEmail) {
    where.actorEmail = options.actorEmail;
  }
  if (options.resourceType) {
    where.resourceType = options.resourceType;
  }
  if (options.resourceId) {
    where.resourceId = options.resourceId;
  }
  if (options.from || options.to) {
    where.createdAt = {};
    if (options.from) {
      where.createdAt.gte = options.from;
    }
    if (options.to) {
      where.createdAt.lte = options.to;
    }
  }
  return where;
}

export async function create(data: CreateAuditLogData) {
  return prisma().auditLog.create({
    data: {
      organizationId: data.organizationId ?? null,
      actorUserId: data.actorUserId,
      actorEmail: data.actorEmail ?? null,
      actorRole: data.actorRole ?? null,
      action: data.action,
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: data.ipAddress ?? null,
    },
  });
}

export async function list(options: ListAuditLogsOptions = {}) {
  return prisma().auditLog.findMany({
    where: listWhere(options),
    orderBy: { createdAt: 'desc' },
    skip: options.skip,
    take: options.take,
  });
}

export async function count(options: ListAuditLogsOptions = {}) {
  return prisma().auditLog.count({
    where: listWhere(options),
  });
}