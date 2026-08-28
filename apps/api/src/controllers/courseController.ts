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
    case 'INVALID_STATUS':
      return fail(res, 400, 'INVALID_STATUS');
    case 'MISSING_FILE':
      return fail(res, 400, 'MISSING_FILE');
    case 'MEDIA_TYPE_NOT_ALLOWED':
      return fail(res, 400, 'MEDIA_TYPE_NOT_ALLOWED');
    case 'MEDIA_TOO_LARGE':
      return fail(res, 413, 'MEDIA_TOO_LARGE');
    case 'COURSE_NOT_FOUND':
      return fail(res, 404, 'COURSE_NOT_FOUND');
    default:
      return fail(res, 500, 'SERVER_ERROR');
  }
}

export async function getCourse(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.getCourse(
      tenantOrganizationId(req),
      req.params.courseId,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

export async function listCourses(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const result = await service.listCourses(tenantOrganizationId(req), {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      sort: req.query.sort,
      order: req.query.order,
    });
    return res.status(200).json({ success: true, data: result.items, meta: result.meta });
  } catch (err: any) {
    return handleError(res, err);
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

export async function updateCourseStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateCourseStatus(
      tenantOrganizationId(req),
      req.params.courseId,
      req.body,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}

interface MulterRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

export async function updateCourseThumbnail(req: MulterRequest, res: Response) {
  try {
    if (!req.user) {
      return fail(res, 401, 'NOT_AUTHENTICATED');
    }
    const data = await service.updateCourseThumbnail(
      tenantOrganizationId(req),
      req.params.courseId,
      req.file,
    );
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return handleError(res, err);
  }
}
