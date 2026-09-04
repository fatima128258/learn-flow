import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/studentLearningService';

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
    case 'MODULE_NOT_FOUND':
      return fail(res, 404, 'MODULE_NOT_FOUND');
    case 'LESSON_NOT_FOUND':
      return fail(res, 404, 'LESSON_NOT_FOUND');
    case 'STUDENT_NOT_ENROLLED':
      return fail(res, 403, 'STUDENT_NOT_ENROLLED');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function listEnrolledCourses(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listEnrolledCourses(
      tenantOrganizationId(req),
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getCourseOverview(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getCourseOverview(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getEnrolledCourseDetail(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    
    // Add detailed logging for debugging
    console.log('[getEnrolledCourseDetail] Request params:', {
      organizationId: req.organizationId,
      userId: req.user.id,
      courseId: req.params.courseId,
      userRole: req.user.role,
    });
    
    const data = await service.getEnrolledCourseDetail(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[getEnrolledCourseDetail] Error:', err);
    return handleError(res, err);
  }
}

export async function listCourseModules(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listCourseModules(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listModuleLessons(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.listModuleLessons(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      req.params.moduleId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getLessonContent(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getLessonContent(
      tenantOrganizationId(req),
      req.user.id,
      req.params.courseId,
      req.params.moduleId,
      req.params.lessonId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function getStudentStats(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getStudentStats(
      tenantOrganizationId(req),
      req.user.id,
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}
