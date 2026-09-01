import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/searchService';

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
    case 'INVALID_QUERY':
      return fail(res, 400, 'INVALID_QUERY');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function searchCourses(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const result = await service.searchCourses(
      tenantOrganizationId(req),
      req.user.id,
      req.query,
    );
    return res.status(200).json({ success: true, data: result.items, meta: result.meta });
  } catch (err) {
    return handleError(res, err);
  }
}
