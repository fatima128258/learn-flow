import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/auditLogService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : undefined;
  switch (message) {
    case 'INVALID_FILTER':
      return fail(res, 400, 'INVALID_FILTER');
    case 'INVALID_DATE_FILTER':
      return fail(res, 400, 'INVALID_DATE_FILTER');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

function queryString(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? value : undefined;
}

export async function listPlatformAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const result = await service.listAuditLogs({
      organizationId: queryString(req.query.organizationId) ?? null,
      page: req.query.page,
      limit: req.query.limit,
      action: req.query.action,
      actorUserId: req.query.actorUserId,
      actorEmail: req.query.actorEmail,
      resourceType: req.query.resourceType,
      resourceId: req.query.resourceId,
      from: req.query.from,
      to: req.query.to,
    });
    return res.status(200).json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listOrgAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    if (!req.organizationId) {
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    }
    const result = await service.listAuditLogs({
      organizationId: req.organizationId,
      page: req.query.page,
      limit: req.query.limit,
      action: req.query.action,
      actorUserId: req.query.actorUserId,
      actorEmail: req.query.actorEmail,
      resourceType: req.query.resourceType,
      resourceId: req.query.resourceId,
      from: req.query.from,
      to: req.query.to,
    });
    return res.status(200).json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    return handleError(res, err);
  }
}