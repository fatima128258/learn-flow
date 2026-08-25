import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/courseService';

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
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'INVALID_SLUG':
      return fail(res, 400, 'INVALID_SLUG');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_SLUG_TAKEN':
      return fail(res, 409, 'COURSE_SLUG_TAKEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function createCourse(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.createCourse(
      tenantOrganizationId(req),
      req.user.id,
      req.body,
    );
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}
