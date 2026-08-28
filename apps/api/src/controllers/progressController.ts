import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/progressService';

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
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'MODULE_NOT_FOUND':
      return fail(res, 404, 'MODULE_NOT_FOUND');
    case 'LESSON_NOT_FOUND':
      return fail(res, 404, 'LESSON_NOT_FOUND');
    case 'STUDENT_NOT_ENROLLED':
      return fail(res, 403, 'STUDENT_NOT_ENROLLED');
    case 'MISSING_FIELDS':
      return fail(res, 400, 'MISSING_FIELDS');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function getCourseProgress(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getCourseProgress(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function recordLessonProgress(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.recordLessonProgress(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}
