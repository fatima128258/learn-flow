import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/lessonService';

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
    case 'INVALID_ORDER':
      return fail(res, 400, 'INVALID_ORDER');
    case 'INVALID_DURATION':
      return fail(res, 400, 'INVALID_DURATION');
    case 'ORGANIZATION_REQUIRED':
      return fail(res, 400, 'ORGANIZATION_REQUIRED');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    case 'MODULE_NOT_FOUND':
      return fail(res, 404, 'MODULE_NOT_FOUND');
    case 'LESSON_NOT_FOUND':
      return fail(res, 404, 'LESSON_NOT_FOUND');
    case 'LESSON_ORDER_TAKEN':
      return fail(res, 409, 'LESSON_ORDER_TAKEN');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listLessons(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listLessons(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function getLesson(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getLesson(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function createLesson(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.createLesson(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.body,
    );
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function updateLesson(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateLesson(
      tenantOrganizationId(req),
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

export async function deleteLesson(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.deleteLesson(
      tenantOrganizationId(req),
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}