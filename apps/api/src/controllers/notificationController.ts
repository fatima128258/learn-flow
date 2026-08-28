import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/notificationService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function tenantOrganizationId(req: AuthenticatedRequest) {
  if (!req.organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return req.organizationId;
}

function handleError(res: Response, err: any) {
  switch (err?.message) {
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'NOTIFICATION_NOT_FOUND':
      return fail(res, 404, 'NOTIFICATION_NOT_FOUND');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await service.listStudentNotifications(
      tenantOrganizationId(req),
      req.user.id,
      { unreadOnly, limit },
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function getUnreadCount(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getUnreadNotificationCount(
      tenantOrganizationId(req),
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function markNotificationAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.markNotificationAsRead(
      tenantOrganizationId(req),
      req.user.id,
      req.params.notificationId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function markAllNotificationsAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.markAllNotificationsAsRead(
      tenantOrganizationId(req),
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}
