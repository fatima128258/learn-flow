import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/commerceService';

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

function tenantOrganizationId(req: AuthenticatedRequest) {
  if (!req.organizationId) {
    throw new Error('ORGANIZATION_REQUIRED');
  }
  return req.organizationId;
}

function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : undefined;
  switch (message) {
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'COURSE_NOT_PUBLISHED':
      return fail(res, 400, 'COURSE_NOT_PUBLISHED');
    case 'ALREADY_ENROLLED':
      return fail(res, 409, 'ALREADY_ENROLLED');
    case 'ALREADY_PURCHASED':
      return fail(res, 409, 'ALREADY_PURCHASED');
    case 'PAYMENT_FAILED':
      return fail(res, 402, 'PAYMENT_FAILED');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function purchaseCourse(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.purchaseCourse(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
