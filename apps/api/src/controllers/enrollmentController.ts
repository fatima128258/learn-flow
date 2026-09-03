import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/enrollmentService';

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
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'COURSE_NOT_PUBLISHED':
      return fail(res, 400, 'COURSE_NOT_PUBLISHED');
    case 'COURSE_REQUIRES_PAYMENT':
      return fail(res, 400, 'COURSE_REQUIRES_PAYMENT');
    case 'ENROLLMENT_NOT_FOUND':
      return fail(res, 404, 'ENROLLMENT_NOT_FOUND');
    case 'ALREADY_ENROLLED':
      return fail(res, 409, 'ALREADY_ENROLLED');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function enroll(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.enroll(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listEnrollments(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listEnrollments(
      tenantOrganizationId(req),
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getEnrollment(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getEnrollment(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function unenroll(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.unenroll(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
